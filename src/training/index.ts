import { ModelTrainer } from "upload-image-plugin/training/ModelTrainer";
import { MagickInfo } from "upload-image-plugin/magick/MagickInfo";
import { SupportedImageFormat } from "upload-image-plugin/types/OutputImageFormat";
import { MemoryEstimationModelParameters } from "upload-image-plugin/types/MemoryEstimationModelParameters";

const quickMode = process.env.QUICK_MODE === "true";
const magickInfo = new MagickInfo();
const modelTrainer = new ModelTrainer(quickMode, magickInfo);

modelTrainer.train().then(
  results => {
    console.log("");
    console.log("Training complete.");
    console.log("");
    console.log("FORMAT | WASTED MEMORY (COST FUNCTION) | OVERESTIMATION");
    console.log("-------|-------------------------------|---------------");
    results.forEach(result => {
      console.log(
        `${result.format.padEnd(6)} | ${
          result.modelIfViable === undefined
            ? "?"
            : ` ${`${Math.round(result.modelIfViable.totalFreeSpace / 1024)} MB`.padEnd(28)} | ${Math.round(
                result.modelIfViable.averageOverestimation * 100
              )}%`
        }`
      );
    });

    const params: Partial<Record<SupportedImageFormat, MemoryEstimationModelParameters>> = Object.fromEntries(
      results.map(x => [x.format, x.modelIfViable?.modelParameters])
    );
    console.log("");
    console.log("PARAMS:");
    console.log(JSON.stringify(params));
    console.log("");
    if (quickMode) {
      console.log("WARNING: QUICK_MODE was set... DO NOT USE THESE PARAMS!");
      console.log("");
    }
  },
  error => {
    console.error(error);
  }
);
