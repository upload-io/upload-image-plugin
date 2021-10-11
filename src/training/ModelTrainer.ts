import { mapObjIndexed, mean, sortBy, sum } from "ramda";
import { MemoryEstimationModel } from "upload-image-plugin/MemoryEstimationModel";
import { MemoryEstimationModelParameters } from "upload-image-plugin/types/MemoryEstimationModelParameters";
import { ModelParameterRange } from "upload-image-plugin/training/ModelParameterRange";
import { Sample } from "upload-image-plugin/training/Sample";
import { OutputImageFormat } from "upload-image-plugin/types/OutputImageFormat";
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
/**
 * Used to generate values for 'MemoryEstimationModel.modelParameters' from a set of training data.
 */
export class ModelTrainer {
  /**
   * We've found images with higher entropy require more memory, so rather than use 'rose:' we require a real image.
   */
  private readonly largeNoisyImage = path.join(__dirname, "input.jpg");

  private readonly popularFormats: OutputImageFormat[] = ["jpg", "jp2", "png", "gif", "webp"];

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

  constructor(private readonly quickMode: boolean, private readonly magickInfo: MagickInfo) {}

  /**
   * IMPORTANT: this must be run on the same instance type as used in PROD.
   */
  async train(): Promise<FormatTrainingResult[]> {
    if (!(await this.exists(this.largeNoisyImage))) {
      throw new Error(`Input image not found: ${this.largeNoisyImage}`);
    }

    const formats = this.quickMode ? this.popularFormats.slice(0, 2) : this.popularFormats;
    const inputDimensions = this.getInputDimensions();
    const outputDimensions = this.getOutputDimensions();
    const sampleSpecs = this.getSampleSpecs(
      inputDimensions.map(x => this.pixels(x)),
      outputDimensions.map(x => this.pixels(x))
    );

    // Limit concurrency to avoid OOM.
    await Bluebird.map(formats, async x => await this.generateInputsIfNotExists(x, inputDimensions), {
      concurrency: 4
    });

    // Run in serial while measuring actual performance.
    await Bluebird.mapSeries(formats, async x => await this.generateSamplesIfNotExists(x, sampleSpecs));

    return await Bluebird.map(formats, async x => this.trainWithSamples(x, await this.readSamples(x)));
  }

  private async generateInputsIfNotExists(format: OutputImageFormat, dimensions: ImageWidthHeight[]): Promise<void> {
    // Run in serial, since parallelism already occurring outside this method.
    await Bluebird.mapSeries(dimensions, async x => await this.generateInputIfNotExists(format, x));
  }

  private async generateSamplesIfNotExists(format: OutputImageFormat, sampleSpecs: SampleSpec[]): Promise<void> {
    const samplesPath = this.getSamplesPath(format);
    if (await this.exists(samplesPath)) {
      this.log(`Reusing samples: ${samplesPath}`);
      return;
    }

    this.log(`Generating samples: ${samplesPath}`);

    // Run in serial while measuring actual performance.
    const samples = await Bluebird.mapSeries(sampleSpecs, async x => await this.calculateSample(format, x));
    await this.writeSamples(format, samples);
  }

  private async calculateSample(format: OutputImageFormat, { inputPixels, outputPixels }: SampleSpec): Promise<Sample> {
    this.log(`Calculating sample: ${format} ${inputPixels} > ${outputPixels}`);

    const imagePath = this.getInputPath(format, inputPixels);
    const { stderr } = await this.execAsync(
      os.platform() === "darwin" ? "/usr/local/bin/gtime" : "/usr/bin/time",
      `-f %M ${this.magickInfo.binaryPath} ${imagePath} -resize ${outputPixels}@ ${format}:output`.split(" ")
    );
    const actualUsedKB = parseInt(stderr.trim());
    if (!Number.isInteger(actualUsedKB)) {
      throw new Error(`Expected integer: '${stderr}'`);
    }

    return {
      actualUsedKB,
      inputPixels,
      outputPixels
    };
  }

  private getSampleSpecs(inputPixelCounts: number[], outputPixelCounts: number[]): SampleSpec[] {
    return inputPixelCounts.flatMap(inputPixels =>
      outputPixelCounts.map((outputPixels): SampleSpec => ({ inputPixels, outputPixels }))
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
    return this.getInputDimensions(); // Just do the same for now.
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

  private async generateInputIfNotExists(format: OutputImageFormat, dimensions: ImageWidthHeight): Promise<void> {
    const imagePath = this.getInputPath(format, this.pixels(dimensions));
    if (await this.exists(imagePath)) {
      this.log(`Reusing input image: ${imagePath}`);
      return;
    }

    this.log(`Generating input image: ${imagePath}`);

    const { width, height } = dimensions;

    await this.execAsync(
      this.magickInfo.binaryPath,
      `${this.largeNoisyImage} -resize ${width}x${height}! ${format}:${imagePath}`.split(" ")
    );
  }

  private async readSamples(format: OutputImageFormat): Promise<Sample[]> {
    return JSON.parse((await fsAsync.readFile(this.getSamplesPath(format))).toString());
  }

  private async writeSamples(format: OutputImageFormat, samples: Sample[]): Promise<void> {
    await fsAsync.writeFile(this.getSamplesPath(format), JSON.stringify(samples));
  }

  private getSamplesPath(format: OutputImageFormat): string {
    return path.join(__dirname, `samples-${this.quickMode ? "quick" : "full"}-${format}.json`);
  }

  private getInputPath(format: OutputImageFormat, pixelCount: number): string {
    return path.join(__dirname, `input-${format}-${pixelCount}.${format}`);
  }

  private trainWithSamples(format: OutputImageFormat, trainingData: Sample[]): FormatTrainingResult {
    const result = this.performBroadSweep(format, trainingData);
    if (result.modelIfViable === undefined) {
      return result;
    }

    return this.performNarrowSweep(format, trainingData, result.modelIfViable.modelParameters);
  }

  private performBroadSweep(format: OutputImageFormat, trainingData: Sample[]): FormatTrainingResult {
    this.log(`Training: ${format} (broad)`);
    return this.performSweep(format, trainingData, this.broad);
  }

  private performNarrowSweep(
    format: OutputImageFormat,
    trainingData: Sample[],
    broadSweepResult: MemoryEstimationModelParameters
  ): FormatTrainingResult {
    this.log(`Training: ${format} (narrow)`);
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
    format: OutputImageFormat,
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
              const estimate = MemoryEstimationModel.getEstimateInKB(x.inputPixels, x.outputPixels, modelParameters);
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
