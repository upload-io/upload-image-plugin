import { SupportedOutputFormat } from "upload-image-plugin/params/SupportedOutputFormat";
import { ImagePipelineStep } from "upload-image-plugin/params/ImagePipelineStep";

export interface ImagePipeline {
  /**
   * Output format
   */
  outputFormat: SupportedOutputFormat | undefined;

  /**
   * Steps
   */
  steps: ImagePipelineStep[];
}
