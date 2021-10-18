import { ImagePipeline } from "upload-image-plugin/types/ImagePipeline";

export interface InputImage {
  contentType: string | undefined;
  path: string;
  pipeline: ImagePipeline;
}
