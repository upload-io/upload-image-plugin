import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { TransformationArtifactPath } from "upload-image-plugin/types/TransformationArtifactPath";
import { OutputImageFormat } from "upload-image-plugin/types/OutputImageFormat";

export interface Params {
  /**
   * Input path
   * @example "/"
   */
  input: TransformationArtifactPath;

  /**
   * Output path
   * @example "/"
   */
  output: TransformationArtifactPath;

  /**
   * Output format
   */
  outputFormat: OutputImageFormat;

  /**
   * Steps
   */
  steps: ImagePipelineStep[];
}
