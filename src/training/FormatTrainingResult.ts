import { MemoryEstimationModelParameters } from "upload-image-plugin/types/MemoryEstimationModelParameters";
import { OutputImageFormat } from "upload-image-plugin/types/OutputImageFormat";

export interface FormatTrainingResult {
  format: OutputImageFormat;
  modelIfViable:
    | undefined
    | {
        averageOverestimation: number;
        modelParameters: MemoryEstimationModelParameters;
        totalFreeSpace: number;
      };
}
