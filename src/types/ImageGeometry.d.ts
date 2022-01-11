import { ImageCropStrategy } from "upload-image-plugin/types/ImageCropStrategy";

/**
 * Image size with optional offset.
 */
export interface ImageGeometry {
  offset?: ImageOffset;
  size: ImageSize;
}

export interface CropGeometry {
  offset: ImageOffset;
  size: ImageSizeWidthHeightForce;
}

/**
 * Image size.
 */
export type ImageSize =
  | ImageSizeWidth
  | ImageSizeHeight
  | ImageSizeWidthHeightMax
  | ImageSizeWidthHeightMin
  | ImageSizeWidthHeightForce
  | ImageSizeWidthHeightShrink
  | ImageSizeWidthHeightCover;

/**
 * Pixel offset.
 */
export interface ImageOffset {
  x: number;
  y: number;
}

/**
 * Width given, height automagically selected to preserve aspect ratio.
 */
export interface ImageSizeWidth {
  type: "width";
  width: number;
}

/**
 * Height given, width automagically selected to preserve aspect ratio.
 */
export interface ImageSizeHeight {
  height: number;
  type: "xheight";
}

/**
 * Maximum values of height and width given, aspect ratio preserved.
 */
export interface ImageSizeWidthHeightMax {
  height: number;
  type: "widthxheight";
  width: number;
}

/**
 * Aspect ratio preserved, image cropped if required. Position dictates cropping strategy.
 */
export interface ImageSizeWidthHeightCover {
  cropStrategy: ImageCropStrategy;
  height: number;
  type: "widthxheightc";
  width: number;
}

/**
 * Minimum values of width and height given, aspect ratio preserved.
 */
export interface ImageSizeWidthHeightMin {
  height: number;
  type: "widthxheight^";
  width: number;
}

/**
 * Width and height emphatically given, original aspect ratio ignored.
 */
export interface ImageSizeWidthHeightForce {
  height: number;
  type: "widthxheight!";
  width: number;
}

/**
 * Shrinks an image with dimension(s) larger than the corresponding width and/or height argument(s).
 */
export interface ImageSizeWidthHeightShrink {
  height: number;
  type: "widthxheight>";
  width: number;
}
