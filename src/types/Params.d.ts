import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";
import { TransformationArtifactPath } from "upload-image-plugin/types/TransformationArtifactPath";

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
   * Steps
   * @minItems 1
   */
  steps: ImagePipelineStep[];
}
