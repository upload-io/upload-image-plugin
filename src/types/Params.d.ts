import { ImagePipelineStep } from "upload-image-plugin/types/ImagePipelineStep";

export interface Params {
  /**
   * Output path
   * @example "/"
   * @pattern ^/.*$
   */
  output: string;

  /**
   * Steps
   * @minItems 1
   */
  steps: ImagePipelineStep[];
}
