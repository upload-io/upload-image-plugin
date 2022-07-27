import { ImagePipelineStepType } from "upload-image-plugin/params/ImagePipelineStep";
import { ScalarMergeBehaviour } from "upload-image-plugin/params/ScalarMergeBehaviour";

export interface ImagePipelineMergeBehaviour {
  outputFormat: ScalarMergeBehaviour;
  outputQuality: ScalarMergeBehaviour;
  steps:
    | {
        mergeBehaviour: "master";
      }
    | {
        fileWhitelist: ImagePipelineStepType[];
        mergeBehaviour:
          | "file"
          | {
              removeDuplicates: false | "end" | "start";
              startWith: "master" | "file";
            };
      };
}

export namespace ImagePipelineMergeBehaviour {
  /**
   * The default merge behaviour (i.e. if none is specified in the transformation) is to allow the user to define crops,
   * but nothing else.
   */
  export const defaultValue: ImagePipelineMergeBehaviour = {
    outputFormat: "master",
    outputQuality: "master",
    steps: {
      fileWhitelist: ["crop"],
      mergeBehaviour: {
        startWith: "file",
        removeDuplicates: "end"
      }
    }
  };
}
