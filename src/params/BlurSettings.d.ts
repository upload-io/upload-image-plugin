export type BlurMode = BlurModeFast | BlurModeSlow;

export interface BlurModeFast {
  /**
   * Blur Mode
   */
  type: "fast";
}

export interface BlurModeSlow {
  /**
   * Blur Strength
   *
   * @isInt
   * @minimum 1
   * @maximum 100
   */
  percentage: number;

  /**
   * Blur Mode
   */
  type: "slow";
}
