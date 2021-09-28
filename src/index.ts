import { Params } from "upload-image-plugin/types/Params";
import { transform } from "upload-plugin-sdk";
import { Transformer } from "upload-image-plugin/Transformer";

const transformer = new Transformer();

export default transform<Params>(async ({ params, transformation, resolve, log, paths }) => {
  await transformer.run(transformation, params, resolve, log);
});
