import { mapObjIndexed, mean, sortBy, sum } from "ramda";
import { MemoryEstimationModel } from "upload-image-plugin/MemoryEstimationModel";
import { MemoryEstimationModelParameters } from "upload-image-plugin/types/MemoryEstimationModelParameters";
import { ModelParameterRange } from "upload-image-plugin/training/ModelParameterRange";
import { Sample } from "upload-image-plugin/training/Sample";
import { SupportedImageFormat } from "upload-image-plugin/types/SupportedImageFormat";
import { FormatTrainingResult } from "upload-image-plugin/training/FormatTrainingResult";
import Bluebird from "bluebird";
import { promises as fsAsync } from "fs";
import path from "path";
import { execFile } from "child_process";
import { MagickInfo } from "upload-image-plugin/magick/MagickInfo";
import { SampleSpec } from "upload-image-plugin/training/SampleSpec";
import { ModelParameterRanges } from "upload-image-plugin/training/ModelParameterRanges";
import os from "os";
import { ImageWidthHeight } from "upload-image-plugin/types/ImageWidthHeight";
import { TrainerMode } from "upload-image-plugin/training/TrainerMode";

/**
 * The `samples-*.json` files must be generated on a PROD-like instance in EC2.
 *
 * From there, you can copy those files and tweak/run the model locally to generate optimal model parameters.
 */
export class ModelTrainer {
  /**
   * We've found images with higher entropy require more memory, so rather than use 'rose:' we require a real image.
   */
  private readonly largeNoisyImage = path.join(__dirname, "input-2.jpg");
  private readonly imagePrefix = path.basename(this.largeNoisyImage, path.extname(this.largeNoisyImage));

  private readonly popularFormats: SupportedImageFormat[] = ["jpg", "png", "gif", "webp"];

  private readonly heightOverWidth = 0.75; // Can be anything, doesn't need to match input image.
  private readonly coefficientPrecision = 4;

  /**
   * We perform a broad sweep to find roughly which params work best, then a narrow sweep to fine-tune them.
   */
  private readonly narrowSweep = {
    relativeDistanceFromOptimalBroadParam: 0.1,
    stepsPerParam: 20
  };

  private readonly broadSweep = {
    space: {
      // space_coefficient * pixel_count = rss_size_kb
      // Since we know at least 3 bytes are required per pixel (RGB), we can start with '0.003' as this would yield
      // rss_size_kb=3 given pixel_count=1024
      coefficient: {
        start: 0.003, // 3 bytes per pixel (3 channels, 1 byte each)
        end: 0.064, // 64 bytes per pixel (because, why not)
        step: 0.002
      },
      constant: {
        start: 0,
        end: 100000,
        step: 10000
      }
    },
    share: {
      coefficient: {
        start: 0,
        end: 1,
        step: 0.05
      },
      constant: {
        start: 0,
        end: 10000000,
        step: 500000
      }
    }
  };

  private readonly broad: ModelParameterRanges = {
    spaceCoefficient: ModelParameterRange.generateRange(this.broadSweep.space.coefficient),
    spaceConstant: ModelParameterRange.generateRange(this.broadSweep.space.constant),
    shareCoefficient: ModelParameterRange.generateRange(this.broadSweep.share.coefficient),
    shareConstant: ModelParameterRange.generateRange(this.broadSweep.share.constant)
  };

  private readonly quickMode: boolean;

  constructor(private readonly mode: TrainerMode, private readonly magickInfo: MagickInfo) {
    this.quickMode = mode === "quick";
  }

  /**
   * IMPORTANT: this must be run on the same instance type as used in PROD.
   */
  async train(): Promise<FormatTrainingResult[]> {
    const formats = this.quickMode ? this.popularFormats.slice(0, 2) : this.popularFormats;

    if (this.mode !== "train_only") {
      if (!(await this.exists(this.largeNoisyImage))) {
        throw new Error(`Input image not found: ${this.largeNoisyImage}`);
      }

      const inputDimensions = this.getInputDimensions();
      const outputDimensions = this.getOutputDimensions();
      const sampleSpecs = this.getSampleSpecs(inputDimensions, outputDimensions);

      // Limit concurrency to avoid OOM.
      await Bluebird.map(formats, async x => await this.generateInputImagesIfNotExists(x, inputDimensions), {
        concurrency: 4
      });

      // Run in serial while measuring actual performance.
      await Bluebird.mapSeries(formats, async x => await this.generateSamplesIfNotExists(x, sampleSpecs));
    }

    return await Bluebird.map(formats, async x => this.trainWithSamples(x, await this.readSamples(x)));
  }

  private async generateInputImagesIfNotExists(
    format: SupportedImageFormat,
    dimensions: ImageWidthHeight[]
  ): Promise<void> {
    const samplesPath = this.getSamplesPath(format);
    if (process.env.FORCE_GENERATE !== "true" && (await this.exists(samplesPath))) {
      this.log(`Skipping input generation, samples already exist: ${samplesPath}`);
      return;
    }

    // Run in serial, since parallelism already occurring outside this method.
    await Bluebird.mapSeries(dimensions, async x => await this.generateInputImageIfNotExists(format, x));
  }

  private async generateSamplesIfNotExists(format: SupportedImageFormat, sampleSpecs: SampleSpec[]): Promise<void> {
    const samplesPath = this.getSamplesPath(format);
    if (await this.exists(samplesPath)) {
      this.log(`Reusing samples: ${samplesPath}`);
      return;
    }

    this.log(`Generating samples: ${samplesPath}`);

    // Run in serial while measuring actual performance.
    const samples = await Bluebird.mapSeries(sampleSpecs, async x => await this.calculateSample(format, x));
    await this.writeSamples(format, samples);

    this.log(`Generated samples: ${samplesPath}`);
  }

  private async calculateSample(
    format: SupportedImageFormat,
    { inputPixels, outputPixels, outputDimensions }: SampleSpec
  ): Promise<Sample> {
    this.log(`Calculating sample: ${format} ${inputPixels} > ${outputPixels}...`);

    const imagePath = this.getInputPath(format, inputPixels);
    const { stderr } = await this.execAsync(
      os.platform() === "darwin" ? "/usr/local/bin/gtime" : "/usr/bin/time",
      `-f %M ${this.magickInfo.binaryPath} ${imagePath} -resize ${outputDimensions.width}x${outputDimensions.height}! ${format}:output`.split(
        " "
      )
    );

    this.log(`Calculated sample: ${format} ${inputPixels} > ${outputPixels}.`);

    const actualUsedKB = parseInt(stderr.trim());
    if (!Number.isInteger(actualUsedKB)) {
      throw new Error(`Expected integer: '${stderr}'`);
    }

    return {
      actualUsedKB,
      inputPixels,
      outputPixels,
      outputDimensions
    };
  }

  private getSampleSpecs(inputPixelCounts: ImageWidthHeight[], outputPixelCounts: ImageWidthHeight[]): SampleSpec[] {
    return inputPixelCounts.flatMap(inputDimensions =>
      outputPixelCounts.map(
        (outputDimensions): SampleSpec => ({
          inputPixels: this.pixels(inputDimensions),
          outputPixels: this.pixels(outputDimensions),
          outputDimensions
        })
      )
    );
  }

  private getInputDimensions(): ImageWidthHeight[] {
    const minWidth = 300;
    const maxWidth = 6000;
    const steps = 10;
    return this.makeSteps(minWidth, maxWidth, steps).map(
      (x): ImageWidthHeight => ({
        width: Math.ceil(x),
        height: Math.ceil(x * this.heightOverWidth)
      })
    );
  }

  private getOutputDimensions(): ImageWidthHeight[] {
    // We make slightly smaller/larger images for the following reasons:
    // - More samples generally (i.e. to cater for memory differences between runs)
    // - More samples for the  "share" constants and coefficients for the model, as this part of the model caters for
    //   the extra memory required for the working buffer when the input/out image are close in size.
    // - Tests resizing to a different aspect ratio (this may more may not be a factor that affects memory).
    return this.getInputDimensions().flatMap(dims =>
      [-10, 0, 10]
        .flatMap(x => [x, x, x]) // Run each transformation 3 times.
        .map(
          (shrink): ImageWidthHeight => ({
            width: dims.width + shrink,
            height: dims.height + shrink
          })
        )
    );
  }

  private makeSteps(start: number, end: number, stepCount: number): number[] {
    const range = end - start;
    return [...Array(stepCount).keys()].map(i => i / (stepCount - 1)).map(spectrum => start + spectrum * range);
  }

  private async exists(folderOrFilePath: string): Promise<boolean> {
    try {
      await fsAsync.access(folderOrFilePath);
      return true;
    } catch {
      return false;
    }
  }

  private async execAsync(path: string, args: string[]): Promise<{ stderr: string; stdout: string }> {
    return await new Promise((resolve, reject) => {
      execFile(path, args, { env: this.magickInfo.environment }, (error, stdout, stderr) => {
        if (error !== null) {
          console.log(stdout);
          console.log(stderr);
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  private pixels({ width, height }: ImageWidthHeight): number {
    return width * height;
  }

  private async generateInputImageIfNotExists(
    format: SupportedImageFormat,
    dimensions: ImageWidthHeight
  ): Promise<void> {
    const imagePath = this.getInputPath(format, this.pixels(dimensions));
    if (await this.exists(imagePath)) {
      this.log(`Reusing input image: ${imagePath}`);
      return;
    }

    this.log(`Generating input image: ${imagePath}`);

    const { width, height } = dimensions;

    let bloatingArg = "";
    if (format === "jpg") {
      bloatingArg = "-interlace Plane"; // Makes a progressive JPEG, which require more space to process.
    } else if (format === "gif" || format === "png") {
      bloatingArg = "-interlace Line"; // Makes an interlaced PNG, which require more space to process.
    }

    if (bloatingArg.length > 0) {
      bloatingArg += " ";
    }

    await this.execAsync(
      this.magickInfo.binaryPath,
      `${this.largeNoisyImage} -resize ${width}x${height}! ${bloatingArg}${format}:${imagePath}`.split(" ")
    );
  }

  private async readSamples(format: SupportedImageFormat): Promise<Sample[]> {
    return JSON.parse((await fsAsync.readFile(this.getSamplesPath(format))).toString());
  }

  private async writeSamples(format: SupportedImageFormat, samples: Sample[]): Promise<void> {
    await fsAsync.writeFile(this.getSamplesPath(format), JSON.stringify(samples));
  }

  private getSamplesPath(format: SupportedImageFormat): string {
    return path.join(__dirname, `samples-${this.quickMode ? "quick" : "full"}-${format}.json`);
  }

  private getInputPath(format: SupportedImageFormat, pixelCount: number): string {
    return path.join(__dirname, `${this.imagePrefix}-${format}-${pixelCount}.${format}`);
  }

  private trainWithSamples(format: SupportedImageFormat, trainingData: Sample[]): FormatTrainingResult {
    const result = this.performBroadSweep(format, trainingData);
    if (result.modelIfViable === undefined) {
      return result;
    }

    return this.performNarrowSweep(format, trainingData, result.modelIfViable.modelParameters);
  }

  private performBroadSweep(format: SupportedImageFormat, trainingData: Sample[]): FormatTrainingResult {
    this.log(`Training: ${format} (phase 1: global maxima estimation)`);
    return this.performSweep(format, trainingData, this.broad);
  }

  private performNarrowSweep(
    format: SupportedImageFormat,
    trainingData: Sample[],
    broadSweepResult: MemoryEstimationModelParameters
  ): FormatTrainingResult {
    this.log(`Training: ${format} (phase 2: global maxima ascension)`);
    return this.performSweep(format, trainingData, this.makeNarrowSweepParams(broadSweepResult));
  }

  private makeNarrowSweepParams(broadSweepResult: MemoryEstimationModelParameters): ModelParameterRanges {
    return mapObjIndexed(x => this.makeNarrowSweepParam(x), broadSweepResult);
  }

  private makeNarrowSweepParam(param: number): number[] {
    const factor = this.narrowSweep.relativeDistanceFromOptimalBroadParam;
    const min = param * (1 - factor);
    const max = param * (1 + factor);
    const isInt = Number.isInteger(param);
    return this.makeSteps(min, max, this.narrowSweep.stepsPerParam).map(x =>
      isInt ? Math.round(x) : Number(x.toFixed(this.coefficientPrecision))
    );
  }

  private performSweep(
    format: SupportedImageFormat,
    trainingData: Sample[],
    { shareConstant, spaceConstant, shareCoefficient, spaceCoefficient }: ModelParameterRanges
  ): FormatTrainingResult {
    const results = spaceCoefficient.flatMap(spaceCoefficient =>
      spaceConstant.flatMap(spaceConstant =>
        shareCoefficient.flatMap(shareCoefficient =>
          shareConstant.flatMap(shareConstant => {
            const modelParameters: MemoryEstimationModelParameters = {
              spaceCoefficient,
              spaceConstant,
              shareCoefficient,
              shareConstant
            };
            const results = trainingData.map((x): { freeSpace: number; overestimationFactor: number } => {
              const estimate = MemoryEstimationModel.getEstimateInKB(
                x.inputPixels,
                x.outputPixels,
                modelParameters,
                modelParameters
              );
              return {
                overestimationFactor: estimate / x.actualUsedKB - 1,
                freeSpace: estimate - x.actualUsedKB
              };
            });

            const overestimations = results.map(x => x.overestimationFactor);
            const freeSpace = results.map(x => x.freeSpace);
            const paramsSucceeded = freeSpace.every(x => x >= 0); // Params failed if caused underestimation.
            const averageOverestimation = mean(overestimations);
            const totalFreeSpace = sum(freeSpace);
            return paramsSucceeded ? [{ averageOverestimation, totalFreeSpace, modelParameters }] : [];
          })
        )
      )
    );

    if (results.length === 0) {
      return {
        format,
        modelIfViable: undefined
      };
    }

    return {
      format,
      // Cost function is total free space (wasted) across all samples, as this is literally what's costing us money!
      modelIfViable: sortBy(x => x.totalFreeSpace, results)[0]
    };
  }

  private log(message: string): void {
    if (this.quickMode) {
      console.log(`[QUICK] ${message}`);
    } else {
      console.log(`[FULL] ${message}`);
    }
  }
}
