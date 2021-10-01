import { LocalFileResolver, Logger, Transformation } from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/types/Params";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { ImageGeometry, ImageOffset, ImageSize } from "upload-image-plugin/types/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { execFile } from "child_process";
import * as os from "os";
import path from "path";

export class Transformer {
  private readonly imageMagickPath: string;
  private readonly imageMagicHomeDir: string;

  constructor() {
    const isMacOS = os.platform() === "darwin";
    const homeDir = path.resolve(__dirname, "../.bin/image-magick/result/");
    this.imageMagickPath = isMacOS ? "/usr/local/bin/magick" : path.resolve(homeDir, "bin/magick");
    this.imageMagicHomeDir = isMacOS ? "" : homeDir;
  }

  async run(
    transformation: Transformation,
    params: Params,
    resolvePath: LocalFileResolver,
    log: Logger
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      log("Transforming image...");
      execFile(
        this.imageMagickPath,
        this.makeArgs(params, resolvePath),
        { env: { MAGICK_HOME: this.imageMagicHomeDir } },
        (error, stdout, stderr) => {
          if (stdout.length > 0) {
            console.log(stdout);
          }
          if (stderr.length > 0) {
            console.error(stderr);
          }
          if (error !== null) {
            log("Image transformation failed.");
            reject(
              new Error(
                error.signal === "SIGKILL"
                  ? `ImageMagick was killed, likely by the Linux OOM Killer.`
                  : `ImageMagick failed. Exit code = ${error.code ?? "?"}. Signal = ${error.signal ?? "?"}.`
              )
            );
          } else {
            log("Image transformed.");
            resolve();
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
