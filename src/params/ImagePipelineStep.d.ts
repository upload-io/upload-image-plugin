import { CropGeometry, ResizeGeometry } from "upload-image-plugin/params/ImageGeometry";
import { CompositeBlendMode } from "upload-image-plugin/params/CompositeBlendMode";
import { CompositeGravityMode } from "upload-image-plugin/params/CompositeGravityMode";

export type ImagePipelineStep = ResizeStep | CropStep | CompositeStep;
export type ImagePipelineStepType = ImagePipelineStep["type"];

export interface CropStep {
  geometry: CropGeometry;
  type: "crop";
}

export interface ResizeStep {
  geometry: ResizeGeometry;
  type: "resize";
}

export interface CompositeStep {
  blend?: CompositeBlendMode;
  gravity?: CompositeGravityMode;
  imageFileId: string;
  left?: number;
  premultiplied?: boolean;
  tile?: boolean;
  top?: number;
  type: "composite";
}
