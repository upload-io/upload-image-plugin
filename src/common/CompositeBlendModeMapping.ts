import { CompositeBlendMode } from "upload-image-plugin/params/CompositeBlendMode";
import { Blend } from "sharp";

export const compositeBlendModeMapping: Record<CompositeBlendMode, Blend> = {
  "color-burn": "colour-burn",
  "color-dodge": "colour-dodge",
  "destination-atop": "dest-atop",
  "destination-in": "dest-in",
  "destination-out": "dest-out",
  "destination-over": "dest-over",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  "source-atop": "atop",
  "source-in": "in",
  "source-out": "out",
  "source-over": "over",
  "add": "add",
  "clear": "clear",
  "darken": "darken",
  "destination": "dest",
  "difference": "difference",
  "exclusion": "exclusion",
  "lighten": "lighten",
  "multiply": "multiply",
  "overlay": "overlay",
  "saturate": "saturate",
  "screen": "screen",
  "source": "source",
  "xor": "xor"
};
