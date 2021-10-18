import { TransformationArtifactPath } from "upload-image-plugin/types/TransformationArtifactPath";
import { ImagePipeline } from "upload-image-plugin/types/ImagePipeline";
import { ImagePipelineMergeBehaviour } from "upload-image-plugin/types/ImagePipelineMergeBehaviour";

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

  pipeline: ImagePipeline;

  pipelineMergeBehaviour: ImagePipelineMergeBehaviour | undefined;
}
