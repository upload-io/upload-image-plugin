import { SupportedImageFormat } from "upload-image-plugin/types/OutputImageFormat";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";

export interface ImagePipeline {
  /**
   * Output format
   */
  outputFormat: SupportedImageFormat | undefined;

  /**
   * Steps
   */
  steps: ImagePipelineStep[];
}
