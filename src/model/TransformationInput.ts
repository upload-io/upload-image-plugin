import { ImagePipeline } from "upload-image-plugin/params/ImagePipeline";
import { DownloadedFileMap } from "upload-image-plugin/model/DownloadedFileMap";

export interface TransformationInput {
  contentType: string | undefined;
  path: string;
  pipeline: ImagePipeline;

  /**
   * Files references by the transformation pipeline, e.g. for watermarks and image layering.
   */
  tempDownloadedFiles: DownloadedFileMap;
}
