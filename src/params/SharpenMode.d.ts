export type SharpenMode = SharpenModeFast | SharpenModeSlow;

export interface SharpenModeFast {
  /**
   * Sharpen Type
   */
  type: "fast";
}

export interface SharpenModeSlow {
  /**
   * Sharpen Strength
   *
   * @isInt
   * @minimum 1
   * @maximum 100
   */
  percentage: number;

  /**
   * Sharpen Type
   */
  type: "slow";
}
