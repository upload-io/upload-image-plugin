import { MemoryEstimationModelParameters } from "upload-image-plugin/types/MemoryEstimationModelParameters";
import { SupportedImageFormat } from "upload-image-plugin/types/OutputImageFormat";

export interface FormatTrainingResult {
  format: SupportedImageFormat;
  modelIfViable:
    | undefined
    | {
        averageOverestimation: number;
        modelParameters: MemoryEstimationModelParameters;
        totalFreeSpace: number;
      };
}
