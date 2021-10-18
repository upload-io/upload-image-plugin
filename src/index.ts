import { Params } from "upload-image-plugin/types/Params";
import { transform } from "upload-plugin-sdk";
import { Transformer } from "upload-image-plugin/Transformer";
import { MagickInfo } from "upload-image-plugin/magick/MagickInfo";
import { EstimationResult } from "upload-image-plugin/types/EstimationResult";

const magickInfo = new MagickInfo();
const transformer = new Transformer(magickInfo);

export default transform<Params, EstimationResult>({
  estimate: async ({ params, resolve, download, getMetadata, log }) =>
    await transformer.estimate(params, resolve, download, getMetadata, log),
  run: async ({ params, resolve, setMetadata, estimationResult, log }) =>
    await transformer.run(params, resolve, setMetadata, estimationResult, log)
});
