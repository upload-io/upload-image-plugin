import {
  DownloadResponse,
  FileMetadata,
  FileMetadataGetter,
  FileMetadataSetter,
  LocalFileResolver,
  Logger
} from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/params/Params";
import { ImagePipelineStep } from "upload-image-plugin/params/ImagePipelineStep";
import { CropGeometry, ImageSize } from "upload-image-plugin/params/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { reverse, uniqBy } from "ramda";
import { SupportedOutputFormat } from "upload-image-plugin/params/SupportedOutputFormat";
import mime from "mime";
import { promises as fsAsync } from "fs";
import { TransformationInput } from "upload-image-plugin/model/TransformationInput";
import { EstimationResult } from "upload-image-plugin/model/EstimationResult";
import { FileDownloader } from "upload-plugin-sdk/dist/types/transform/FileDownloader";
import { ParamsFromFile } from "upload-image-plugin/params/ParamsFromFile";
import { ImagePipeline } from "upload-image-plugin/params/ImagePipeline";
import { TransformationArtifactPath } from "upload-image-plugin/params/TransformationArtifactPath";
import { DownloadRequest } from "upload-plugin-sdk/dist/types/transform/DownloadRequest";
import { ImagePipelineMergeBehaviour } from "upload-image-plugin/params/ImagePipelineMergeBehaviour";
import sharp, { Region, ResizeOptions, Sharp } from "sharp";
import { ImageCropStrategy } from "upload-image-plugin/params/ImageCropStrategy";
import { compositeBlendModeMapping } from "upload-image-plugin/common/CompositeBlendModeMapping";
import * as Path from "path";

export class Transformer {
  private readonly memoryEstimateConstantBytes = 1024 * 1024 * 10; // 10MB
  private readonly memoryEstimateFileSizeCoefficient = 10; // Fast rough estimate

  async estimate(
    params: Params,
    resolvePath: LocalFileResolver,
    download: FileDownloader,
    getMetadata: FileMetadataGetter,
    log: Logger
  ): Promise<EstimationResult> {
    const inputImage = await this.getInputImage(params, resolvePath, download, getMetadata);
    const fileSizeBytes = (await fsAsync.stat(inputImage.path)).size;
    const physicalMemoryB = this.memoryEstimateConstantBytes + this.memoryEstimateFileSizeCoefficient * fileSizeBytes;
    const physicalMemoryMB = Math.ceil(physicalMemoryB / (1024 * 1024));

    log(`Estimated memory: ${physicalMemoryMB} MB`);

    return {
      input: inputImage,
      estimation: {
        physicalMemoryMB
      }
    };
  }

  async run(
    { output }: Params,
    resolvePath: LocalFileResolver,
    setMetadata: FileMetadataSetter,
    { input }: EstimationResult,
    log: Logger
  ): Promise<void> {
    log("Transforming image...");
    await this.transformImage(input, output, resolvePath);
    await Promise.all([this.deleteTemporaryFiles(input), this.setContentType(input, output, setMetadata)]);
    log("Image transformed.");
  }

  private async deleteTemporaryFiles(input: TransformationInput): Promise<void> {
    await Promise.all(
      Object.values(input.tempDownloadedFiles).map(async x => {
        if (x !== undefined) {
          await fsAsync.unlink(x.request.destinationFile);
        }
      })
    );
  }

  private async getInputImage(
    params: Params,
    resolvePath: LocalFileResolver,
    download: FileDownloader,
    getMetadata: FileMetadataGetter
  ): Promise<TransformationInput> {
    const inputPath = resolvePath(params.input);
    const [pipeline, metadata, paramsFromFile] = await this.getPipeline(inputPath, params, getMetadata);
    const tempFileDownloadRequests = this.makeTemporaryFileDownloadRequests(pipeline, resolvePath);
    const tempFileDirectories = Array.from(
      new Set(Object.values(tempFileDownloadRequests).map(x => Path.dirname(x.destinationFile)))
    );
    await Promise.all(tempFileDirectories.map(async x => await fsAsync.mkdir(x, { recursive: true })));

    if (paramsFromFile === undefined) {
      return {
        path: inputPath,
        contentType: metadata.contentType,
        pipeline,
        tempDownloadedFiles: this.zipFileDownloadRequests(
          tempFileDownloadRequests,
          await download(tempFileDownloadRequests)
        )
      };
    }

    const sourceFile = paramsFromFile.input;
    const destinationFile = inputPath;
    const request: DownloadRequest = { destinationFile, sourceFile };
    const downloads: Record<"file" | string, DownloadResponse> = await download({
      file: request,
      ...tempFileDownloadRequests
    });
    const { file, ...tempFileDownloadResponses } = downloads;

    if (file.isError) {
      throw new Error(`Failed to download file for cropping: ${paramsFromFile.input}`);
    }

    return {
      path: request.destinationFile,
      contentType: file.headers["content-type"],
      pipeline,
      tempDownloadedFiles: this.zipFileDownloadRequests(tempFileDownloadRequests, tempFileDownloadResponses)
    };
  }

  /**
   * Key is the file ID or file URL used by the transformation steps.
   * Files will be deleted after the transformation runs.
   */
  private makeTemporaryFileDownloadRequests(
    pipeline: ImagePipeline,
    resolvePath: LocalFileResolver
  ): Record<string, DownloadRequest> {
    return Object.fromEntries(
      pipeline.steps.flatMap(
        (x): Array<[string, DownloadRequest]> => {
          switch (x.type) {
            case "resize":
            case "crop":
            case "flip":
            case "blur":
            case "negative":
            case "greyscale":
              return [];
            case "composite":
              return [
                [
                  x.imageFileId,
                  {
                    sourceFile: x.imageFileId,
                    destinationFile: resolvePath(`/tmp/${x.imageFileId}`)
                  }
                ]
              ];
            default:
              assertUnreachable(x);
          }
        }
      )
    );
  }

  private zipFileDownloadRequests(
    requests: Record<string, DownloadRequest>,
    responses: Record<string, DownloadResponse>
  ): Record<string, { request: DownloadRequest; response: DownloadResponse }> {
    return Object.fromEntries(
      Object.entries(requests).map(([key, request]) => [key, { request, response: responses[key] }])
    );
  }

  private async getPipeline(
    inputPath: string,
    params: Params,
    getMetadata: FileMetadataGetter
  ): Promise<[ImagePipeline, FileMetadata, ParamsFromFile | undefined]> {
    const metadata = await getMetadata(params.input);
    if (metadata.contentType !== "application/json") {
      return [params.pipeline, metadata, undefined];
    }

    const paramsFromFile: ParamsFromFile = JSON.parse((await fsAsync.readFile(inputPath)).toString());
    return [this.mergePipelines(paramsFromFile, params), metadata, paramsFromFile];
  }

  private mergePipelines(file: ParamsFromFile, master: Params): ImagePipeline {
    const behaviour = master.pipelineMergeBehaviour ?? ImagePipelineMergeBehaviour.defaultValue;
    return {
      outputFormat: this.mergeOutputFormat(file.pipeline, master.pipeline, behaviour),
      steps: this.mergeSteps(file.pipeline, master.pipeline, behaviour)
    };
  }

  private mergeOutputFormat(
    file: ImagePipeline,
    master: ImagePipeline,
    behaviour: ImagePipelineMergeBehaviour
  ): SupportedOutputFormat | undefined {
    switch (behaviour.outputFormat) {
      case "master":
        return master.outputFormat ?? undefined;
      case "file":
        return file.outputFormat ?? undefined;
      case "fileThenMaster":
        return file.outputFormat ?? master.outputFormat ?? undefined;
      default:
        assertUnreachable(behaviour.outputFormat);
    }
  }

  private mergeSteps(
    file: ImagePipeline,
    master: ImagePipeline,
    behaviour: ImagePipelineMergeBehaviour
  ): ImagePipelineStep[] {
    if (behaviour.steps.mergeBehaviour === "master") {
      return master.steps;
    }

    const whitelist = behaviour.steps.fileWhitelist;
    const fileSteps = file.steps.filter(x => whitelist.includes(x.type));
    if (behaviour.steps.mergeBehaviour === "file") {
      return fileSteps;
    }

    let steps: ImagePipelineStep[];
    switch (behaviour.steps.mergeBehaviour.startWith) {
      case "master":
        steps = [...master.steps, ...file.steps];
        break;
      case "file":
        steps = [...file.steps, ...master.steps];
        break;
      default:
        assertUnreachable(behaviour.steps.mergeBehaviour.startWith);
    }

    switch (behaviour.steps.mergeBehaviour.removeDuplicates) {
      case "start":
        steps = uniqBy(x => x.type, steps);
        break;
      case "end":
        steps = reverse(uniqBy(x => x.type, reverse(steps)));
        break;
      case false:
        break;
      default:
        assertUnreachable(behaviour.steps.mergeBehaviour.removeDuplicates);
    }

    return steps;
  }

  private async transformImage(
    input: TransformationInput,
    output: TransformationArtifactPath,
    resolvePath: LocalFileResolver
  ): Promise<void> {
    const inputResolved = input.path;
    const outputResolved = resolvePath(output);

    const imagePipelinePartial = input.pipeline.steps.reduce(
      (img, step) => this.applyTransformationArg(input, step, img),
      sharp(inputResolved)
    );

    const { outputFormat } = input.pipeline;
    const imagePipeline =
      outputFormat === undefined ? imagePipelinePartial : imagePipelinePartial.toFormat(outputFormat as any);

    // Buffer to new file, since input file and output file may be the same location, and AFAIK libvips may stream
    // its processing such that the output is written whilst the input is read.
    const tempPath = `${outputResolved}.tmp`;
    await imagePipeline.toFile(tempPath);
    await fsAsync.rename(tempPath, outputResolved);
  }

  private applyTransformationArg(input: TransformationInput, step: ImagePipelineStep, img: Sharp): Sharp {
    switch (step.type) {
      case "crop":
        return img.extract(this.getCropOptions(step.geometry));
      case "resize":
        return img.resize(this.getResizeOptions(step.geometry.size));
      case "negative":
        return img.negate({ alpha: step.negateAlpha });
      case "greyscale":
        return img.greyscale(true);
      case "flip": {
        switch (step.axis) {
          case "horizontal":
            return img.flop();
          case "vertical":
            return img.flip();
          default:
            assertUnreachable(step.axis);
        }
        break;
      }
      case "blur": {
        switch (step.mode.type) {
          case "fast":
            return img.blur();
          case "slow": {
            const min = 0.3;
            const max = 1000;
            const range = max - min;
            // This converts the range 1-100 to 0-100. This is because we advertise a minimum blur of 1 (which we want to
            // map to Sharp's minimum blur of 0.3) rather than advertise a minimum blur of 0, which would be confusing as it
            // would misleadingly imply no blur.
            const zeroToHundred = (step.mode.percentage - 1) * (100 / 99);
            const blurAmount = min + range * (zeroToHundred / 100);
            return img.blur(blurAmount);
          }
          default:
            assertUnreachable(step.mode);
        }
        break;
      }
      case "composite":
        return img.composite([
          {
            input: this.getTemporaryDownloadedFilePath(input, step.imageFileId),
            top: step.top,
            left: step.left,
            tile: step.tile,
            premultiplied: !(step.premultiplyBaseImage ?? true),
            gravity: step.gravity,
            blend: step.blend === undefined ? undefined : compositeBlendModeMapping[step.blend]
          }
        ]);
      default:
        assertUnreachable(step);
    }
  }

  private getTemporaryDownloadedFilePath(input: TransformationInput, fileIdOrUrl: string): string {
    const tempDownloadedFile = input.tempDownloadedFiles[fileIdOrUrl];
    if (tempDownloadedFile === undefined) {
      throw new Error(`File was never downloaded: ${fileIdOrUrl}`);
    }
    if (tempDownloadedFile.response.isError) {
      throw new Error(`Failed to download ancillary file for image transformations: ${fileIdOrUrl}`);
    }
    return tempDownloadedFile.request.destinationFile;
  }

  private getCropOptions({ size, offset }: CropGeometry): Region {
    return {
      width: size.width,
      height: size.height,
      top: offset.y,
      left: offset.x
    };
  }

  private getResizeOptions(size: ImageSize): ResizeOptions {
    switch (size.type) {
      case "xheight":
        return {
          height: size.height
        };
      case "width":
        return {
          width: size.width
        };
      case "widthxheight":
        return {
          width: size.width,
          height: size.height,
          fit: "inside"
        };
      case "widthxheight^":
        return {
          width: size.width,
          height: size.height,
          fit: "outside"
        };
      case "widthxheight!":
        return {
          width: size.width,
          height: size.height,
          fit: "fill"
        };
      case "widthxheight>":
        return {
          width: size.width,
          height: size.height,
          fit: "inside",
          withoutEnlargement: true
        };
      case "widthxheightc":
        return {
          width: size.width,
          height: size.height,
          fit: "cover",
          position: this.getCropPosition(size.cropStrategy)
        };
      default:
        assertUnreachable(size);
    }
  }

  private getCropPosition(cropStrategy: ImageCropStrategy): string {
    const strategies: Record<ImageCropStrategy["type"], string> = {
      fixedBottom: "bottom",
      fixedBottomLeft: "left bottom",
      fixedBottomRight: "right bottom",
      fixedCenter: "center",
      fixedLeft: "left",
      fixedRight: "right",
      fixedTop: "top",
      fixedTopLeft: "left top",
      fixedTopRight: "right top",
      smartAttention: "attention",
      smartEntropy: "entropy"
    };
    return strategies[cropStrategy.type];
  }

  private async setContentType(
    input: TransformationInput,
    output: TransformationArtifactPath,
    setMetadata: FileMetadataSetter
  ): Promise<void> {
    const outputFormat = input.pipeline.outputFormat ?? undefined;
    const mimeType = outputFormat === undefined ? input.contentType : mime.getType(outputFormat);
    await setMetadata(output, { contentType: mimeType ?? undefined });
  }
}
