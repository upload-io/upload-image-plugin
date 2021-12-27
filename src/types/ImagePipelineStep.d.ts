import { CropGeometry, ImageGeometry } from "upload-image-plugin/types/ImageGeometry";

export type ImagePipelineStep = ResizeStep | CropStep;
export type ImagePipelineStepType = ImagePipelineStep["type"];

export interface CropStep {
  geometry: CropGeometry;
  type: "crop";
}

export interface ResizeStep {
  geometry: ImageGeometry;
  type: "resize";
}
