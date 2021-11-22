/**
 * Supported output image format.
 */
export type SupportedImageFormat =
  | "ai"
  | "bmp"
  | "bmp2"
  | "bmp3"
  | "epi"
  | "eps"
  | "gif"
  | "heic"
  | "ico"
  | "jp2"
  | "jpg"
  | "pdf"
  | "pjpeg"
  | "png"
  | "psd"
  | "svg"
  | "tiff"
  | "webp"; // Get from 'magick identify -list format | grep rw'. We use a subset to reduce bug surface area.
