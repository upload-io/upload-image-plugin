import { LocalFileResolver, Logger, Transformation } from "upload-plugin-sdk";
import { Params } from "upload-image-plugin/types/Params";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { ImageGeometry, ImageOffset, ImageSize } from "upload-image-plugin/types/ImageGeometry";
import { assertUnreachable } from "upload-image-plugin/common/TypeUtils";
import { spawn } from "child_process";
import * as os from "os";
import path from "path";
import * as v8 from "v8";

export class Transformer {
  private readonly imageMagickPath: string;
  private readonly imageMagicHomeDir: string;
  private readonly maxHeapSizeKB: number;
  private readonly minImageMagickMemoryKB = 1024 * 10; // 10MB

  constructor() {
    const isMacOS = os.platform() === "darwin";
    const homeDir = path.resolve(__dirname, "../.bin/image-magick/result/");
    this.imageMagickPath = isMacOS ? "/usr/local/bin/magick" : path.resolve(homeDir, "bin/magick");
    this.imageMagicHomeDir = isMacOS ? "" : homeDir;
    this.maxHeapSizeKB = Math.ceil(v8.getHeapStatistics().heap_size_limit / 1024);
  }

  async run(
    transformation: Transformation,
    params: Params,
    resolvePath: LocalFileResolver,
    log: Logger
  ): Promise<void> {
    log("Transforming image...");
    await this.runToleratingOOM(params, resolvePath, log);
  }

  private async runToleratingOOM(params: Params, resolvePath: LocalFileResolver, log: Logger): Promise<void> {
    let memory = this.maxHeapSizeKB;
    let success = false;
    while (!success && memory >= this.minImageMagickMemoryKB) {
      const result = await this.tryRun(params, resolvePath, log, memory);
      if (result === "OOM") {
        memory = Math.ceil(memory * 0.7);
        log(`Failed due to OOM. Retrying with ${memory}KB of memory...`);
      } else {
        success = true;
      }
    }

    if (!success) {
      throw new Error(`ImageMagick was killed, likely by the Linux OOM Killer.`);
    }
  }

  private async tryRun(
    params: Params,
    resolvePath: LocalFileResolver,
    log: Logger,
    maxMemoryKB: number
  ): Promise<"OOM" | undefined> {
    return await new Promise<"OOM" | undefined>((resolve, reject) => {
      const args = this.makeArgs(params, resolvePath, maxMemoryKB);
      const onExitEvent = "exit";
      const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        if (code === 0) {
          resolve(undefined);
        } else if (signal === "SIGKILL") {
          // SIGKILL is most-likely due to the Linux OOM Killer killing the process.
          resolve("OOM");
        } else {
          reject(new Error(`ImageMagick failed. Exit code = ${code ?? "?"}. Signal = ${signal ?? "?"}.`));
        }
      };

      log(`Using command: ${this.imageMagickPath} ${args.join(" ")}`);

      const proc = spawn(this.imageMagickPath, args, { env: { MAGICK_HOME: this.imageMagicHomeDir } });
      proc.stdout.on("data", x => console.log(x.toString()));
      proc.stderr.on("data", x => console.error(x.toString()));
      proc.on("error", e => {
        reject(e);
        proc.kill();
        proc.removeListener(onExitEvent, onExit);
      });
      proc.on(onExitEvent, onExit);
    });
  }

  private makeArgs(params: Params, resolve: LocalFileResolver, maxMemoryKB: number): string[] {
    return [
      ...this.makeMemoryArg(maxMemoryKB),
      resolve(params.input),
      ...this.makeTransformationArgs(params.steps),
      `${this.makeOutputFormat(params)}${resolve(params.output)}`
    ];
  }

  private makeMemoryArg(maxMemoryKB: number): string[] {
    return `-limit memory ${maxMemoryKB}KiB`.split(" ");
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
