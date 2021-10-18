import { OutputImageFormat } from "upload-image-plugin/types/OutputImageFormat";
import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";

export interface ImagePipeline {
  /**
   * Output format
   */
  outputFormat: OutputImageFormat | undefined;

  /**
   * Steps
   */
  steps: ImagePipelineStep[];
}
