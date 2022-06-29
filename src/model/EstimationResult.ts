import { PluginEstimationResult } from "upload-plugin-sdk";
import { TransformationInput } from "upload-image-plugin/model/TransformationInput";

export interface EstimationResult extends PluginEstimationResult {
  input: TransformationInput;
}
