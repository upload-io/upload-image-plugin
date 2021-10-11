import { ImageWidthHeight } from "upload-image-plugin/types/ImageWidthHeight";

export class GeometryUtils {
  static dimsFromAspectRatio(ratio: ImageWidthHeight, area: number): ImageWidthHeight {
    return GeometryUtils.dimsFromAspectRatioFactor(ratio.height / ratio.width, area);
  }

  static dimsFromAspectRatioFactor(heightOverWidth: number, area: number): ImageWidthHeight {
    return {
      width: Math.max(1, Math.round(Math.sqrt(area / heightOverWidth))),
      height: Math.max(1, Math.round(Math.sqrt(area / (1 / heightOverWidth))))
    };
  }
}
