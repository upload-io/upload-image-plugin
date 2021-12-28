import { FileMetadataGetter, FileMetadataSetter, LocalFileResolver, Logger } from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/types/Params";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { CropGeometry, ImageSize } from "upload-image-plugin/types/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { reverse, uniqBy } from "ramda";
import { SupportedImageFormat } from "upload-image-plugin/types/SupportedImageFormat";
import mime from "mime";
import { promises as fsAsync } from "fs";
import { TransformationInput } from "upload-image-plugin/types/TransformationInput";
import { EstimationResult } from "upload-image-plugin/types/EstimationResult";
import { FileDownloader } from "upload-plugin-sdk/dist/types/transform/FileDownloader";
import { ParamsFromFile } from "upload-image-plugin/types/ParamsFromFile";
import { ImagePipeline } from "upload-image-plugin/types/ImagePipeline";
import { TransformationArtifactPath } from "upload-image-plugin/types/TransformationArtifactPath";
import { DownloadRequest } from "upload-plugin-sdk/dist/types/transform/DownloadRequest";
import { ImagePipelineMergeBehaviour } from "upload-image-plugin/types/ImagePipelineMergeBehaviour";
import sharp, { Region, ResizeOptions, Sharp } from "sharp";

export class Transformer {
  private readonly memoryEstimateConstantBytes = 1024 * 1024 * 10; // 10MB
  private readonly memoryEstimateFileSizeCoefficient = 50; // Fast rough estimate -- prevents needing to call out to ImageMagick to perform estimation, so transformation runs faster.

  /**
   * See README.md for a full explanation on how we calculate and
   * limit ImageMagick's memory usage.
   */
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
    await this.setContentType(input, output, setMetadata);
    log("Image transformed.");
  }

  private async getInputImage(
    params: Params,
    resolvePath: LocalFileResolver,
    download: FileDownloader,
    getMetadata: FileMetadataGetter
  ): Promise<TransformationInput> {
    const inputPath = resolvePath(params.input);
    const metadata = await getMetadata(params.input);
    if (metadata.contentType !== "application/json") {
      return {
        path: inputPath,
        contentType: metadata.contentType,
        pipeline: params.pipeline
      };
    }

    const paramsFromFile: ParamsFromFile = JSON.parse((await fsAsync.readFile(inputPath)).toString());
    const sourceFile = paramsFromFile.input;
    const destinationFile = inputPath;
    const request: DownloadRequest = { destinationFile, sourceFile };
    const response = await download({ file: request });

    if (response.file.isError) {
      throw new Error(`Failed to download file for cropping: ${paramsFromFile.input}`);
    }

    return {
      path: request.destinationFile,
      contentType: response.file.headers["content-type"],
      pipeline: this.mergePipelines(paramsFromFile, params)
    };
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
  ): SupportedImageFormat | undefined {
    switch (behaviour.outputFormat) {
      case "master":
        return master.outputFormat;
      case "file":
        return file.outputFormat;
      case "fileThenMaster":
        return file.outputFormat ?? master.outputFormat;
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
      (img, step) => this.applyTransformationArg(step, img),
      sharp(inputResolved)
    );

    const { outputFormat } = input.pipeline;
    const imagePipeline =
      outputFormat === undefined ? imagePipelinePartial : imagePipelinePartial.toFormat(outputFormat as any);

    const tempPath = `${outputResolved}.tmp`;
    await imagePipeline.toFile(tempPath);
    await fsAsync.rename(tempPath, outputResolved);
  }

  private applyTransformationArg(step: ImagePipelineStep, img: Sharp): Sharp {
    switch (step.type) {
      case "crop":
        return img.extract(this.getCropOptions(step.geometry));
      case "resize":
        return img.resize(this.getResizeOptions(step.geometry.size));
      default:
        assertUnreachable(step);
    }
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
      default:
        assertUnreachable(size);
    }
  }

  private async setContentType(
    input: TransformationInput,
    output: TransformationArtifactPath,
    setMetadata: FileMetadataSetter
  ): Promise<void> {
    const outputFormat = input.pipeline.outputFormat;
    const mimeType = outputFormat === undefined ? input.contentType : mime.getType(outputFormat);
    await setMetadata(output, { contentType: mimeType ?? undefined });
  }
}
