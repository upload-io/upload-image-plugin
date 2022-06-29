import { DownloadResponse } from "upload-plugin-sdk";
import { DownloadRequest } from "upload-plugin-sdk/dist/types/transform/DownloadRequest";

type FileIdOrUrl = string;
export type DownloadedFileMap = Record<
  FileIdOrUrl,
  { request: DownloadRequest; response: DownloadResponse } | undefined
>;
