import { PluginEstimationResult } from "upload-plugin-sdk";
import { TransformationInput } from "upload-image-plugin/types/TransformationInput";

export interface EstimationResult extends PluginEstimationResult {
  input: TransformationInput;
}
