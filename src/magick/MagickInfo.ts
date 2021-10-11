import os from "os";
import path from "path";

export class MagickInfo {
  readonly binaryPath: string;
  readonly environment: NodeJS.ProcessEnv;
  private readonly imageMagicHomeDir: string;

  constructor() {
    const isMacOS = os.platform() === "darwin";
    const homeDir = path.resolve(__dirname, "../.bin/image-magick/result/");
    this.binaryPath = isMacOS ? "/usr/local/bin/magick" : path.resolve(homeDir, "bin/magick");
    this.imageMagicHomeDir = isMacOS ? "" : homeDir;
    this.environment = { MAGICK_HOME: this.imageMagicHomeDir };
  }
}
