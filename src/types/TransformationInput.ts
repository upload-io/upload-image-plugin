import { ImagePipeline } from "upload-image-plugin/types/ImagePipeline";

export interface TransformationInput {
  contentType: string | undefined;
  path: string;
  pipeline: ImagePipeline;
}
