import { CropGeometry, ResizeGeometry } from "upload-image-plugin/params/ImageGeometry";
import { CompositeBlendMode } from "upload-image-plugin/params/CompositeBlendMode";
import { CompositeGravityMode } from "upload-image-plugin/params/CompositeGravityMode";
import { BlurMode } from "upload-image-plugin/params/BlurSettings";

export type ImagePipelineStep =
  | ResizeStep
  | CropStep
  | CompositeStep
  | BlurStep
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
