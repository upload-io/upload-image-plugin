import { Params } from "upload-image-plugin/params/Params";
import { transform } from "upload-plugin-sdk";
import { Transformer } from "upload-image-plugin/Transformer";
import { EstimationResult } from "upload-image-plugin/model/EstimationResult";

const transformer = new Transformer();

export default transform<Params, EstimationResult>({
  estimate: async ({ params, resolve, download, getMetadata, log }) =>
    await transformer.estimate(params, resolve, download, getMetadata, log),
  run: async ({ params, resolve, setMetadata, estimationResult, log }) =>
    await transformer.run(params, resolve, setMetadata, estimationResult, log)
});
