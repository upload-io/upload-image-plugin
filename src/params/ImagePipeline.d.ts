import { SupportedOutputFormat } from "upload-image-plugin/params/SupportedOutputFormat";
import { ImagePipelineStep } from "upload-image-plugin/params/ImagePipelineStep";
import { OutputQuality } from "upload-image-plugin/params/OutputQuality";

export interface ImagePipeline {
  /**
   * Output format
   */
  outputFormat: SupportedOutputFormat | undefined;

  /**
   * Output quality
   */
  outputQuality: OutputQuality | undefined;

  /**
   * Steps
   */
  steps: ImagePipelineStep[];
}
