import { FileMetadataGetter, FileMetadataSetter, LocalFileResolver, Logger } from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/types/Params";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { ImageGeometry, ImageOffset, ImageSize } from "upload-image-plugin/types/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { execFile } from "child_process";
import { MemoryEstimationModel } from "upload-image-plugin/MemoryEstimationModel";
import { ImageWidthHeight } from "upload-image-plugin/types/ImageWidthHeight";
import { reverse, uniqBy } from "ramda";
import { ImageMagickError } from "upload-image-plugin/types/Errors";
import { MagickInfo } from "upload-image-plugin/magick/MagickInfo";
import { GeometryUtils } from "upload-image-plugin/common/GeometryUtils";
import { OutputImageFormat } from "upload-image-plugin/types/OutputImageFormat";
import os from "os";
import mime from "mime";
import { promises as fsAsync } from "fs";
import { InputImage } from "upload-image-plugin/types/InputImage";
import { EstimationResult } from "upload-image-plugin/types/EstimationResult";
import { FileDownloader } from "upload-plugin-sdk/dist/types/transform/FileDownloader";
import { ParamsFromFile } from "upload-image-plugin/types/ParamsFromFile";
import { ImagePipeline } from "upload-image-plugin/types/ImagePipeline";
import { TransformationArtifactPath } from "upload-image-plugin/types/TransformationArtifactPath";
import { DownloadRequest } from "upload-plugin-sdk/dist/types/transform/DownloadRequest";
import { ImagePipelineMergeBehaviour } from "upload-image-plugin/types/ImagePipelineMergeBehaviour";

export class Transformer {
  private readonly timePath = os.platform() === "darwin" ? "/usr/local/bin/gtime" : "/usr/bin/time";

  constructor(private readonly magickInfo: MagickInfo) {}

  /**
   * See README.md for a full explanation on how we calculate and limit ImageMagick's memory usage.
   */
  async estimate(
    params: Params,
    resolvePath: LocalFileResolver,
    download: FileDownloader,
    getMetadata: FileMetadataGetter,
    log: Logger
  ): Promise<EstimationResult> {
    const inputImage = await this.getInputImage(params, resolvePath, download, getMetadata);
    const [inputDimensions, inputFormat] = await this.getInputDimensionsAndFormat(inputImage.path);
    const outputDimensions = this.getOutputDimensions(inputDimensions, inputImage.pipeline);
    log(`Input dimensions: ${JSON.stringify(inputDimensions)}`);
    log(`Output dimensions: ${JSON.stringify(outputDimensions)}`);

    const inputPixels = this.countPixels(inputDimensions);
    const outputPixels = this.countPixels(this.getOutputDimensions(inputDimensions, inputImage.pipeline));
    const estimateKB = MemoryEstimationModel.getEstimateInKBForFormat(
      inputPixels,
      outputPixels,
      inputFormat,
      inputImage.pipeline.outputFormat ?? inputFormat
    );

    const physicalMemoryMB = Math.ceil(estimateKB / 1024);

    log(`Estimated memory: ${physicalMemoryMB} MB`);

    return {
      inputImage,
      estimation: {
        physicalMemoryMB
      }
    };
  }

  async run(
    { output }: Params,
    resolvePath: LocalFileResolver,
    setMetadata: FileMetadataSetter,
    { inputImage }: EstimationResult,
    log: Logger
  ): Promise<void> {
    log("Transforming image...");
    await this.transformImage(inputImage, output, resolvePath, log);
    await this.setContentType(inputImage, output, setMetadata);
    log("Image transformed.");
  }

  private async getInputImage(
    params: Params,
    resolvePath: LocalFileResolver,
    download: FileDownloader,
    getMetadata: FileMetadataGetter
  ): Promise<InputImage> {
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
  ): OutputImageFormat | undefined {
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
    inputImage: InputImage,
    output: TransformationArtifactPath,
    resolvePath: LocalFileResolver,
    log: Logger
  ): Promise<void> {
    const args = this.makeArgs(inputImage, output, resolvePath);
    log(`Using command: ${this.magickInfo.binaryPath} ${args.join(" ")}`);

    const { stderr } = await this.runMagick(this.timePath, ["-f", "%M", this.magickInfo.binaryPath, ...args]);
    const actualUsedKB = parseInt(stderr.trim());
    if (!Number.isInteger(actualUsedKB)) {
      throw new Error(`Expected integer: '${stderr}'`);
    }
    log(`Actual memory usage: ${Math.ceil(actualUsedKB / 1024)} MB`);
  }

  private async setContentType(
    inputImage: InputImage,
    output: TransformationArtifactPath,
    setMetadata: FileMetadataSetter
  ): Promise<void> {
    const outputFormat = inputImage.pipeline.outputFormat;
    const mimeType = outputFormat === undefined ? inputImage.contentType : mime.getType(outputFormat);
    await setMetadata(output, { contentType: mimeType ?? undefined });
  }

  private async getInputDimensionsAndFormat(imagePath: string): Promise<[ImageWidthHeight, OutputImageFormat]> {
    let stdout: string;
    try {
      stdout = (await this.runMagick(this.magickInfo.binaryPath, ["identify", imagePath])).stdout;
    } catch (e) {
      throw new Error("Invalid image format.");
    }

    const firstLine: string = stdout.split("\n")[0];
    if (firstLine === undefined) {
      throw new Error("Unexpected error: firstLine was undefined.");
    }

    // e.g. "images_jpf/09356268.jpf JP2 3532x2649 3532x2649+0+0 8-bit sRGB 0.000u 0:00.000"
    const lineParts = firstLine.split(" ");

    const format = lineParts[1]?.toLowerCase() as OutputImageFormat;
    if (format === undefined) {
      throw new Error(`Unexpected error: format was undefined: '${firstLine}'`);
    }

    const widthHeight = lineParts[2];
    if (widthHeight === undefined) {
      throw new Error(`Unexpected error: widthHeight was undefined: '${firstLine}'`);
    }

    const assertInt = (value: string | undefined): number => {
      if (value === undefined) {
        throw new Error(`An axis from ImageMagick 'identify' is a undefined: ${widthHeight}`);
      }
      const int = parseFloat(value);
      if (isNaN(int)) {
        throw new Error(`An axis from ImageMagick 'identify' is a NaN: ${widthHeight}`);
      }
      if (!Number.isInteger(int)) {
        throw new Error(`An axis from ImageMagick 'identify' is a float: ${widthHeight}`);
      }
      return int;
    };
    const [widthStr, heightStr] = widthHeight.split("x");
    return [
      {
        width: assertInt(widthStr),
        height: assertInt(heightStr)
      },
      format
    ];
  }

  private getOutputDimensions(inputImage: ImageWidthHeight, pipeline: ImagePipeline): ImageWidthHeight {
    const resizeSteps = reverse(pipeline.steps)
      .flatMap(x => (x.type === "resize" ? [x] : []))
      .map(x => x.geometry.size);
    if (resizeSteps.length === 0) {
      return inputImage;
    }
    const resize = resizeSteps[0];

    const boundingBox = (isMaximum: boolean, box: ImageWidthHeight): ImageWidthHeight => {
      const boxRatio = box.width / box.height;
      const imageRatio = inputImage.width / inputImage.height;
      if (isMaximum ? imageRatio > boxRatio : imageRatio < boxRatio) {
        // Image must be bound by width.
        return {
          width: box.width,
          height: Math.ceil(inputImage.height * (box.width / inputImage.width))
        };
      }

      // Image must be bound by height, or ratio is equal in which case it doesn't matter which we bound by.
      return {
        width: Math.ceil(inputImage.width * (box.height / inputImage.height)),
        height: box.height
      };
    };

    switch (resize.type) {
      case "area@":
        return GeometryUtils.dimsFromAspectRatio(inputImage, resize.area);
      case "scale%":
        return {
          width: Math.ceil(inputImage.width * (resize.scale / 100)),
          height: Math.ceil(inputImage.height * (resize.scale / 100))
        };
      case "scale-x%xscale-y%":
        return {
          width: Math.ceil(inputImage.width * (resize.scaleX / 100)),
          height: Math.ceil(inputImage.height * (resize.scaleY / 100))
        };
      case "x:y":
        return GeometryUtils.dimsFromAspectRatio({ width: resize.x, height: resize.y }, this.countPixels(inputImage));
      case "xheight":
        return {
          width: Math.ceil(resize.height * (inputImage.width / inputImage.height)),
          height: resize.height
        };
      case "width":
        return {
          width: resize.width,
          height: Math.ceil(resize.width * (inputImage.height / inputImage.width))
        };
      case "widthxheight":
        return boundingBox(true, resize);
      case "widthxheight^":
        return boundingBox(false, resize);
      case "widthxheight!":
        return {
          width: resize.width,
          height: resize.height
        };
      case "widthxheight<":
        if (inputImage.width >= resize.width && inputImage.height >= resize.height) {
          return inputImage;
        }
        return boundingBox(false, resize);
      case "widthxheight>":
        if (inputImage.width <= resize.width && inputImage.height <= resize.height) {
          return inputImage;
        }
        return boundingBox(true, resize);
      default:
        assertUnreachable(resize);
    }
  }

  private countPixels({ width, height }: ImageWidthHeight): number {
    return width * height;
  }

  private async runMagick(path: string, args: string[]): Promise<{ stderr: string; stdout: string }> {
    return await new Promise((resolve, reject) => {
      execFile(path, args, { env: this.magickInfo.environment }, (error, stdout, stderr) => {
        if (error !== null) {
          console.log(stdout);
          console.log(stderr);
          if (error.signal === "SIGKILL") {
            reject(new Error("ImageMagick was killed with SIGKILL (likely by the Linux OOM Killer)."));
            // Do not kill process to unify with other OOM errors: this will terminate all other transformations too.
            // We got lucky this time, so let's just keep on going and leave the other image transformations to run!
            // process.exit(137);
          } else {
            reject(new ImageMagickError(stdout, stderr, error.code, error.signal));
          }
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  private makeArgs(
    inputImage: InputImage,
    outputPath: TransformationArtifactPath,
    resolve: LocalFileResolver
  ): string[] {
    return [
      inputImage.path,
      ...this.makeTransformationArgs(inputImage.pipeline.steps),
      `${this.makeOutputFormat(inputImage.pipeline)}${resolve(outputPath)}`
    ];
  }

  private makeOutputFormat(params: ImagePipeline): string {
    return params.outputFormat === undefined ? "" : `${params.outputFormat}:`;
  }

  private makeTransformationArgs(steps: ImagePipelineStep[]): string[] {
    return steps.flatMap(x => this.makeTransformationArg(x));
  }

  private makeTransformationArg(step: ImagePipelineStep): string[] {
    switch (step.type) {
      case "crop":
      case "resize":
        return this.makeTransformationUnivariateGeometryArg(step);
      default:
        assertUnreachable(step);
    }
  }

  private makeTransformationUnivariateGeometryArg({
    geometry,
    type
  }: {
    geometry: ImageGeometry;
    type: string;
  }): string[] {
    return [`-${type}`, this.makeTransformationGeometryArg(geometry)];
  }

  private makeTransformationGeometryArg(geometry: ImageGeometry): string {
    return `${this.makeTransformationSizeArg(geometry.size)}${
      geometry.offset === undefined ? "" : this.makeTransformationOffsetArg(geometry.offset)
    }`;
  }

  private makeTransformationOffsetArg(offset: ImageOffset): string {
    return `${this.signInteger(offset.x)}${this.signInteger(offset.y)}`;
  }

  private makeTransformationSizeArg(size: ImageSize): string {
    switch (size.type) {
      case "area@":
        return `${size.area}@`;
      case "scale%":
        return `${size.scale}%`;
      case "scale-x%xscale-y%":
        return `${size.scaleX}x${size.scaleY}%`;
      case "x:y":
        return `${size.x}:${size.y}`;
      case "xheight":
        return `x${size.height}`;
      case "width":
        return `${size.width}`;
      case "widthxheight":
        return `${size.width}x${size.height}`;
      case "widthxheight!":
        return `${size.width}x${size.height}!`;
      case "widthxheight<":
        return `${size.width}x${size.height}<`;
      case "widthxheight>":
        return `${size.width}x${size.height}>`;
      case "widthxheight^":
        return `${size.width}x${size.height}^`;
      default:
        assertUnreachable(size);
    }
  }

  private signInteger(number: number): string {
    const rounded = Math.round(number);
    if (rounded >= 0) {
      return `+${rounded}`;
    }
    return rounded.toString();
  }
}
