import { LocalFileResolver, Logger, Transformation } from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/types/Params";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { ImageGeometry, ImageOffset, ImageSize } from "upload-image-plugin/types/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { execFile } from "child_process";
import * as os from "os";
import path from "path";
import * as v8 from "v8";

export class Transformer {
  private readonly imageMagickPath: string;
  private readonly imageMagicHomeDir: string;
  private readonly imageMagickBaseArgs: string[];

  constructor() {
    const isMacOS = os.platform() === "darwin";
    const homeDir = path.resolve(__dirname, "../.bin/image-magick/result/");
    this.imageMagickPath = isMacOS ? "/usr/local/bin/magick" : path.resolve(homeDir, "bin/magick");
    this.imageMagicHomeDir = isMacOS ? "" : homeDir;
    const maxHeapSizeKB = Math.ceil(v8.getHeapStatistics().heap_size_limit / 1024);
    this.imageMagickBaseArgs = `-limit memory ${maxHeapSizeKB}KiB`.split(" ");
  }

  async run(
    transformation: Transformation,
    params: Params,
    resolvePath: LocalFileResolver,
    log: Logger
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      log("Transforming image...");

      const args = this.makeArgs(params, resolvePath);
      log(`Using command: ${this.imageMagickPath} ${args.join(" ")}`);

      execFile(
        this.imageMagickPath,
        args,
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

            if (error.signal === "SIGKILL") {
              // Causes Upload to restart the process with lower heap, which we then use to limit ImageMagick's memory usage.
              console.error("ImageMagick was killed by the Linux OOM Killer.");
              process.exit(137);
            } else {
              reject(
                new Error(`ImageMagick failed. Exit code = ${error.code ?? "?"}. Signal = ${error.signal ?? "?"}.`)
              );
            }
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
      ...this.imageMagickBaseArgs,
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
