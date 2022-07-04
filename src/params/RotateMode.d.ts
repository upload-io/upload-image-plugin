import { ColorRGBA } from "upload-image-plugin/params/ColorRGBA";

export type RotateMode = RotateModeAuto | RotateModeManual;

export interface RotateModeAuto {
  /**
   * Rotate Type
   */
  type: "automatic";
}

export interface RotateModeManual {
  /**
   * Background Color
   */
  backgroundColor: ColorRGBA;

  /**
   * Rotate Degrees
   *
   * @isInt
   * @minimum 0
   * @maximum 360
   */
  degrees: number;

  /**
   * Rotate Mode
   */
  type: "manual";
}
