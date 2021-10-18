import { ImageGeometry } from "upload-image-plugin/types/ImageGeometry";

export type ImagePipelineStep = ResizeStep | CropStep;
export type ImagePipelineStepType = ImagePipelineStep["type"];

export interface CropStep {
  geometry: ImageGeometry;
  type: "crop";
}

export interface ResizeStep {
  geometry: ImageGeometry;
  type: "resize";
}
