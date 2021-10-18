import { ImagePipelineStepType } from "upload-image-plugin/types/ImagePipelineStep";

export interface ImagePipelineMergeBehaviour {
  outputFormat: "master" | "file" | "fileThenMaster";
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
  export const defaultValue: ImagePipelineMergeBehaviour = {
    outputFormat: "master",
    steps: {
      fileWhitelist: [],
      mergeBehaviour: {
        startWith: "file",
        removeDuplicates: "end"
      }
    }
  };
}
