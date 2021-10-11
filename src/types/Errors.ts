export class ImageMagickError extends Error {
  constructor(
    readonly stdout: string,
    readonly stderr: string,
    readonly exitCode: number | undefined,
    readonly signalCode: NodeJS.Signals | undefined
  ) {
    super(`ImageMagick failed. Exit code = ${exitCode ?? "?"}. Signal = ${signalCode ?? "?"}.`);
    Object.setPrototypeOf(this, ImageMagickError.prototype);
  }
}
