/**
 * Output Quality
 *
 * @isInt
 * @minimum 1
 * @maximum 100
 */
export type OutputQuality = number;

export namespace OutputQuality {
  export const defaultValue: OutputQuality = 80; // Sync with: upload.config.json
}
