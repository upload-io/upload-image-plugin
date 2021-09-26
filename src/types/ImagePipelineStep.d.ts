import { ImageGeometry } from "upload-image-plugin/types/ImageGeometry";

export type ImagePipelineStep = ResizeStep

interface ResizeStep {
  geometry: ImageGeometry
  type: "resize",
}
