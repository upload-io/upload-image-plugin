import { CropGeometry, ResizeGeometry } from "upload-image-plugin/params/ImageGeometry";
import { CompositeBlendMode } from "upload-image-plugin/params/CompositeBlendMode";
import { CompositeGravityMode } from "upload-image-plugin/params/CompositeGravityMode";

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
  /**
   * Blur Amount
   *
   * @isInt
   * @minimum 1
   * @maximum 100
   */
  percentage: number;

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
   * Blend Mode: Disable Base Image Premultiplication
   */
  premultiplied?: boolean;

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
