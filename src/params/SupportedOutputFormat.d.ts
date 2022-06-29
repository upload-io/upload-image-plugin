/**
 * Supported output image format.
 *
 * Important: ensure each of these work when transcoding large images (6000x4000) without downsizing.
 */
export type SupportedOutputFormat =
  // | "avif" -- times out on larger images
  // | "gif" -- requires a custom build of lipvips (i.e. not the binary bundled with sharp).
  // | "heic" -- produces un-open-able images & also times-out with large images
  // | "heif" -- produces un-open-able images & also times-out with large images
  // | "j2c" -- requires a custom build of lipvips (i.e. not the binary bundled with sharp).
  // | "j2k" -- requires a custom build of lipvips (i.e. not the binary bundled with sharp).
  // | "jp2" -- requires a custom build of lipvips (i.e. not the binary bundled with sharp).
  // | "jpx" -- requires a custom build of lipvips (i.e. not the binary bundled with sharp).
  | "jpg"
  | "png"
  // | "raw" -- unsupported output format
  // | "tif" -- odd one to support, given we're not supporting so many others. Works without issue, though.
  | "webp";
