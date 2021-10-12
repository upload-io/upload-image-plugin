import { ImageWidthHeight } from "upload-image-plugin/types/ImageWidthHeight";

export interface SampleSpec {
  inputPixels: number;
  outputDimensions: ImageWidthHeight;
  outputPixels: number;
}
