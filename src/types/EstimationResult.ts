import { PluginEstimationResult } from "upload-plugin-sdk";
import { InputImage } from "upload-image-plugin/types/InputImage";

export interface EstimationResult extends PluginEstimationResult {
  inputImage: InputImage;
}
