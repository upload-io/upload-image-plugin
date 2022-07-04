import { Color } from "upload-image-plugin/params/Color";

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
  backgroundColor: Color;

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
