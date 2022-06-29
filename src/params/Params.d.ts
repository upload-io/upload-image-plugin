import { TransformationArtifactPath } from "upload-image-plugin/params/TransformationArtifactPath";
import { ImagePipeline } from "upload-image-plugin/params/ImagePipeline";
import { ImagePipelineMergeBehaviour } from "upload-image-plugin/params/ImagePipelineMergeBehaviour";

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
