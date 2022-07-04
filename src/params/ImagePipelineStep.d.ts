import { CropGeometry, ResizeGeometry } from "upload-image-plugin/params/ImageGeometry";
import { CompositeBlendMode } from "upload-image-plugin/params/CompositeBlendMode";
import { CompositeGravityMode } from "upload-image-plugin/params/CompositeGravityMode";
import { BlurMode } from "upload-image-plugin/params/BlurMode";
import { SharpenMode } from "upload-image-plugin/params/SharpenMode";
import { RotateMode } from "upload-image-plugin/params/RotateMode";
import { ColorRGB } from "upload-image-plugin/params/ColorRGB";

export type ImagePipelineStep =
  | ResizeStep
  | CropStep
  | RotateStep
  | CompositeStep
  | BlurStep
  | SharpenStep
  | TintStep
  | FlipStep
  | GreyscaleStep
  | NegativeStep;
export type ImagePipelineStepType = ImagePipelineStep["type"];

export interface CropStep {
  /**
   * Geometry defining an image area and location.
   */
  geometry: CropGeometry;

  /**
   * Transformation Type
   */
  type: "crop";
}

export interface ResizeStep {
  /**
   * Geometry defining an image area.
   */
  geometry: ResizeGeometry;

  /**
   * Transformation Type
   */
  type: "resize";
}

export interface RotateStep {
  mode: RotateMode;

  /**
   * Transformation Type
   */
  type: "rotate";
}

export interface NegativeStep {
  /**
   * Negate Alpha Channel
   */
  negateAlpha: boolean;

  /**
   * Transformation Type
   */
  type: "negative";
}

export interface TintStep {
  /**
   * Tint Color
   */
  color: ColorRGB;

  /**
   * Transformation Type
   */
  type: "tint";
}

export interface GreyscaleStep {
  /**
   * Transformation Type
   */
  type: "greyscale";
}

export interface BlurStep {
  mode: BlurMode;

  /**
   * Transformation Type
   */
  type: "blur";
}

export interface SharpenStep {
  mode: SharpenMode;

  /**
   * Transformation Type
   */
  type: "sharpen";
}

export interface FlipStep {
  /**
   * Axis
   */
  axis: "horizontal" | "vertical";

  /**
   * Transformation Type
   */
  type: "flip";
}

export interface CompositeStep {
  /**
   * Blend Mode
   */
  blend?: CompositeBlendMode;

  /**
   * Image Position (Relative)
   */
  gravity?: CompositeGravityMode;

  /**
   * Image
   */
  imageFileId: string;

  /**
   * Image Position (Absolute X)
   * @isInt
   */
  left?: number;

  /**
   * Premultiply Base Image
   */
  premultiplyBaseImage?: boolean;

  /**
   * Repeat Image
   */
  tile?: boolean;

  /**
   * Image Position (Absolute Y)
   * @isInt
   */
  top?: number;

  /**
   * Transformation Type
   */
  type: "composite";
}
