/**
 * Image size with optional offset.
 */
export interface ImageGeometry {
  offset?: ImageOffset;
  size: ImageSize;
}

/**
 * Image size.
 */
export type ImageSize =
  | ImageSizeScale
  | ImageSizeScaleXY
  | ImageSizeWidth
  | ImageSizeHeight
  | ImageSizeWidthHeight
  | ImageSizeMinWidthHeight
  | ImageSizeMaxWidthHeight
  | ImageSizeWidthHeightShrink
  | ImageSizeWidthHeightEnlarge
  | ImageSizeArea
  | ImageSizeAspectRatio;

/**
 * Pixel offset.
 */
export interface ImageOffset {
  x: number;
  y: number;
}

/**
 * Height and width both scaled by specified percentage.
 */
export interface ImageSizeScale {
  scale: number;
  type: "scale%";
}

/**
 * Height and width individually scaled by specified percentages.
 */
export interface ImageSizeScaleXY {
  scaleX: number;
  scaleY: number;
  type: "scale-x%xscale-y%";
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
 * Width and height emphatically given, original aspect ratio ignored.
 */
export interface ImageSizeWidthHeight {
  height: number;
  type: "widthxheight";
  width: number;
}

/**
 * Minimum values of width and height given, aspect ratio preserved.
 */
export interface ImageSizeMinWidthHeight {
  height: number;
  type: "widthxheight^";
  width: number;
}

/**
 * Maximum values of height and width given, aspect ratio preserved.
 */
export interface ImageSizeMaxWidthHeight {
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

/**
 * Enlarges an image with dimension(s) smaller than the corresponding width and/or height argument(s).
 */
export interface ImageSizeWidthHeightEnlarge {
  height: number;
  type: "widthxheight<";
  width: number;
}

/**
 * Resize image to have specified area in pixels. Aspect ratio is preserved.
 */
export interface ImageSizeArea {
  area: number;
  type: "area@";
}

/**
 * Aspect ratio (e.g. 3:2 = 1.5).
 */
export interface ImageSizeAspectRatio {
  area: number;
  type: "x:y";
  x: number;
  y: number;
}
