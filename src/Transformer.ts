import { LocalFileResolver, Logger, Transformation, TransformationEstimation } from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/types/Params";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { ImageGeometry, ImageOffset, ImageSize } from "upload-image-plugin/types/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { execFile } from "child_process";
import * as os from "os";
import path from "path";
import { MemoryEstimationModel } from "upload-image-plugin/MemoryEstimationModel";
import { ImageWidthHeight } from "upload-image-plugin/types/ImageWidthHeight";
import { reverse } from "ramda";
import { ImageMagickError } from "upload-image-plugin/types/Errors";

export class Transformer {
  private readonly imageMagickPath: string;
  private readonly imageMagicHomeDir: string;

  constructor() {
    const isMacOS = os.platform() === "darwin";
    const homeDir = path.resolve(__dirname, "../.bin/image-magick/result/");
    this.imageMagickPath = isMacOS ? "/usr/local/bin/magick" : path.resolve(homeDir, "bin/magick");
    this.imageMagicHomeDir = isMacOS ? "" : homeDir;
  }

  /**
   * See README.md for a full explanation on how we calculate and limit ImageMagick's memory usage.
   */
  async estimate(
    transformation: Transformation,
    params: Params,
    resolvePath: LocalFileResolver,
    log: Logger
  ): Promise<TransformationEstimation> {
    const inputDimensions = await this.getInputDimensions(resolvePath(params.input));
    const outputDimensions = this.getOutputDimensions(inputDimensions, params);
    log(`Input dimensions: ${JSON.stringify(inputDimensions)}`);
    log(`Output dimensions: ${JSON.stringify(outputDimensions)}`);

    const inputPixels = this.countPixels(inputDimensions);
    const outputPixels = this.countPixels(this.getOutputDimensions(inputDimensions, params));
    const estimateKB = MemoryEstimationModel.getEstimateInKB(inputPixels, outputPixels);
    log(`Estimated RAM upperbound: ${estimateKB} KB`);

    return {
      physicalMemoryMB: Math.ceil(estimateKB / 1024)
    };
  }

  async run(
    transformation: Transformation,
    estimation: TransformationEstimation,
    params: Params,
    resolvePath: LocalFileResolver,
    log: Logger
  ): Promise<void> {
    log("Transforming image...");

    const args = this.makeArgs(params, resolvePath);
    log(`Using command: ${this.imageMagickPath} ${args.join(" ")}`);

    await this.runMagick(args);

    log("Image transformed.");
  }

  private async getInputDimensions(imagePath: string): Promise<ImageWidthHeight> {
    let stdout: string;
    try {
      stdout = (await this.runMagick(["identify", imagePath])).stdout;
    } catch (e) {
      throw new Error("Invalid image format.");
    }

    const firstLine: string = stdout.split("\n")[0];
    if (firstLine === undefined) {
      throw new Error("Unexpected error: firstLine was undefined.");
    }

    // e.g. "images_jpf/09356268.jpf JP2 3532x2649 3532x2649+0+0 8-bit sRGB 0.000u 0:00.000"
    const widthHeight = firstLine.split(" ")[2];
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
    return {
      width: assertInt(widthStr),
      height: assertInt(heightStr)
    };
  }

  private getOutputDimensions(inputImage: ImageWidthHeight, params: Params): ImageWidthHeight {
    const resizeSteps = reverse(params.steps)
      .flatMap(x => (x.type === "resize" ? [x] : []))
      .map(x => x.geometry.size);
    if (resizeSteps.length === 0) {
      return inputImage;
    }
    const resize = resizeSteps[0];

    const dimsFromAspectRatio = (ratio: ImageWidthHeight, area: number): ImageWidthHeight => ({
      width: Math.ceil(Math.sqrt(area / (ratio.height / ratio.width))),
      height: Math.ceil(Math.sqrt(area / (ratio.width / ratio.height)))
    });
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
        return dimsFromAspectRatio(inputImage, resize.area);
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
        return dimsFromAspectRatio({ width: resize.x, height: resize.y }, this.countPixels(inputImage));
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

  private async runMagick(args: string[]): Promise<{ stderr: string; stdout: string }> {
    return await new Promise((resolve, reject) => {
      execFile(
        this.imageMagickPath,
        args,
        { env: { MAGICK_HOME: this.imageMagicHomeDir } },
        (error, stdout, stderr) => {
          if (error !== null) {
            console.log(stdout);
            console.log(stderr);
            if (error.signal === "SIGKILL") {
              // Have upload-transformer handle this process as if it requested too much memory from the OS (137),
              // because by extension, it did.
              console.error("ImageMagick was killed with SIGKILL (likely by the Linux OOM Killer).");
              process.exit(137);
            } else {
              reject(new ImageMagickError(stdout, stderr, error.code, error.signal));
            }
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });
  }

  private makeArgs(params: Params, resolve: LocalFileResolver): string[] {
    return [
      resolve(params.input),
      ...this.makeTransformationArgs(params.steps),
      `${this.makeOutputFormat(params)}${resolve(params.output)}`
    ];
  }

  private makeOutputFormat(params: Params): string {
    return params.outputFormat === undefined ? "" : `${params.outputFormat}:`;
  }

  private makeTransformationArgs(steps: ImagePipelineStep[]): string[] {
    return steps.flatMap(x => this.makeTransformationArg(x));
  }

  private makeTransformationArg(step: ImagePipelineStep): string[] {
    switch (step.type) {
      case "resize":
        return this.makeTransformationUnivariateGeometryArg(step);
      default:
        assertUnreachable(step.type);
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
