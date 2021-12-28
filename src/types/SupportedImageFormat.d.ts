/**
 * Supported output image format.
 */
export type SupportedImageFormat =
  | "avif"
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
  | "tif"
  | "webp";
