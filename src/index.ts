import { Params } from "upload-image-plugin/types/Params";
import { transform } from "upload-plugin-sdk";
import { Transformer } from "upload-image-plugin/Transformer";
import { MagickInfo } from "upload-image-plugin/magick/MagickInfo";

const magickInfo = new MagickInfo();
const transformer = new Transformer(magickInfo);

export default transform<Params>({
  estimate: async ({ params, transformation, resolve, log }) =>
    await transformer.estimate(transformation, params, resolve, log),
  run: async ({ params, transformation, resolve, setMetadata, log }) =>
    await transformer.run(transformation, params, resolve, setMetadata, log)
});
