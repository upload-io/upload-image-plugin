import { SupportedOutputFormat } from "upload-image-plugin/params/SupportedOutputFormat";
import { ImagePipelineStep } from "upload-image-plugin/params/ImagePipelineStep";

export interface ImagePipeline {
  /**
   * Output format
   */
  outputFormat: SupportedOutputFormat | undefined | null; // We support 'null' because it's easier to generate using JMES path (i.e. for our templates) than 'undefined' is.

  /**
   * Steps
   */
  steps: ImagePipelineStep[];
}
