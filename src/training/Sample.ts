import { SampleSpec } from "upload-image-plugin/training/SampleSpec";

export interface Sample extends SampleSpec {
  actualUsedKB: number;
}
