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

  /**
   * ImageMagickMemory:V8HeapMemory Ratio.
   *
   * Memory for the V8 heap and ImageMagick is allocated very differently: memory allocated for the V8 heap can be
   * fragmented, whereas ImageMagick is contiguous (so the memory is harder for the OS to find). Also, V8 heap uses mmap
   * not malloc. ImageMagic uses malloc up to the 'memory' limit and mmap up to the 'map' limit. All this is to say: the
   * ratio we infer as a safe amount of memory to grant ImageMagick w/o triggering the OOM killer needs to be
   * substantially less than what's been granted for the V8 heap: the virgin (i.e. never-before-used) portion of the V8
   * heap is far from being a proxy for the amount of contiguous memory that's available for malloc'ing by ImageMagick.
   *
   * Also: ideally we'd reserve part of our memory usage for ImageMagick, and part for V8 heap usage. However, we can't
   * currently, and right now we must assume our process chain's memory is limited via cgroup to an amount equal to the
   * V8 heap, so to ensure garbage doesn't slowly consume the entire V8 heap (thus leaving no memory left in the cgroup
   * for ImageMagick) we GC the Node.js process after every ImageMagick call. In future, we'll allow plugins to define
   * how much of the cgroup memory quota should be allocated to V8 heap (and consequently how much is left for
   * ImageMagick, Buffer allocations, etc.)
   */
  private readonly imageMagickMemoryRatio = 0.2;

  constructor() {
    const isMacOS = os.platform() === "darwin";
    const homeDir = path.resolve(__dirname, "../.bin/image-magick/result/");
    this.imageMagickPath = isMacOS ? "/usr/local/bin/magick" : path.resolve(homeDir, "bin/magick");
    this.imageMagicHomeDir = isMacOS ? "" : homeDir;
    const kb = (bytes: number): string => `${Math.ceil(bytes / 1024)}KB`;
    const v8HeapSizeLimitBytes = v8.getHeapStatistics().heap_size_limit;

    // It's common for 'map' to be a factor (larger) than 'memory'. 'map' is memory-mapped files: the same as what
    // the V8 heap uses (except ImageMagick will more-aggressively require contiguous memory than tolerating fragments).
    const imMemoryBytes = v8HeapSizeLimitBytes * this.imageMagickMemoryRatio;
    const imMemoryMapBytes = imMemoryBytes * 2;

    this.imageMagickBaseArgs = `-limit memory ${kb(imMemoryBytes)} -limit map ${kb(imMemoryMapBytes)}`.split(" ");
  }

  async run(
    transformation: Transformation,
    params: Params,
    resolvePath: LocalFileResolver,
    log: Logger
  ): Promise<void> {
    // Ensure garbage doesn't creep over our internal heap limit. We'll remove this in future (see large comment above).
    global.gc();

    // Call ImageMagick last, after the GC has been run, to better-ensure memory is available.
    await this.runImageTransformation(params, resolvePath, log);
  }

  private async runImageTransformation(params: Params, resolvePath: LocalFileResolver, log: Logger): Promise<void> {
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
