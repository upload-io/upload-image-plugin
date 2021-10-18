import { ImageGeometry } from "upload-image-plugin/types/ImageGeometry";

export type ImagePipelineStep = ResizeStep;
export type ImagePipelineStepType = ImagePipelineStep["type"];

export interface ResizeStep {
  geometry: ImageGeometry;
  type: "resize";
}
