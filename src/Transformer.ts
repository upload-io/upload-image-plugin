import { LocalFileResolver, Logger, Transformation, TransformationEstimation } from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/types/Params";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { ImageGeometry, ImageOffset, ImageSize } from "upload-image-plugin/types/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { execFile } from "child_process";
import * as os from "os";
import path from "path";
import { promises as fsAsync } from "fs";

export class Transformer {
  private readonly imageMagickPath: string;
  private readonly imageMagicHomeDir: string;
  // private readonly channels: 3; // RGB
  // private readonly pixelSize: 2; // 16-bit (Quantum Depth of 16)

  /**
   * We add a drift to account for ImageMagick using more memory than it's been told to.
   */
  private readonly imageMagickDrift = 1.1;

  constructor() {
    const isMacOS = os.platform() === "darwin";
    const homeDir = path.resolve(__dirname, "../.bin/image-magick/result/");
    this.imageMagickPath = isMacOS ? "/usr/local/bin/magick" : path.resolve(homeDir, "bin/magick");
    this.imageMagicHomeDir = isMacOS ? "" : homeDir;
  }

  async estimate(
    transformation: Transformation,
    params: Params,
    resolvePath: LocalFileResolver
  ): Promise<TransformationEstimation> {
    const input = resolvePath(params.input);
    // Todo: use 'identity' to estimate the size of the input image. Then look at resized size, and estimate them both together.
    // const { stdout } = await this.runMagick(["identify", resolvePath(params.input)]);
    const fileSizeMB = (await fsAsync.stat(input)).size / (1024 * 1024);
    const poorMansMemoryEstimate = fileSizeMB * 33; // e.g. 6MB JPEG requires 198MB. This is just a temporary estimate: we'll use 'identity' to determine this more accurately in future.
    return {
      physicalMemoryMB: Math.ceil(poorMansMemoryEstimate * this.imageMagickDrift)
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

    const args = this.makeArgs(params, resolvePath, estimation);
    log(`Using command: ${this.imageMagickPath} ${args.join(" ")}`);

    await this.runMagick(args);

    log("Image transformed.");
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
            reject(
              new Error(
                error.signal === "SIGKILL"
                  ? "ImageMagick was killed with SIGKILL (likely by the Linux OOM Killer)."
                  : `ImageMagick failed. Exit code = ${error.code ?? "?"}. Signal = ${error.signal ?? "?"}.`
              )
            );
            // Have upload-transformer handle this process as if it requested too much memory from the OS (137),
            // because by extension, it did.
            process.exit(137);
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });
  }

  private makeArgs(params: Params, resolve: LocalFileResolver, estimation: TransformationEstimation): string[] {
    return [
      ...this.makeMemoryArgs(estimation),
      resolve(params.input),
      ...this.makeTransformationArgs(params.steps),
      `${this.makeOutputFormat(params)}${resolve(params.output)}`
    ];
  }

  private makeOutputFormat(params: Params): string {
    return params.outputFormat === undefined ? "" : `${params.outputFormat}:`;
  }

  private makeMemoryArgs(estimation: TransformationEstimation): string[] {
    // We remove the margin so that's available to the OS when ImageMagick drifts.
    const mb = `${Math.ceil(estimation.physicalMemoryMB / this.imageMagickDrift)}MiB`;
    return ["-limit", "memory", mb, "-limit", "map", mb];
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
