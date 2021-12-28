# ImageMagick Manual Build

Creates a build of ImageMagick that is both "uninstalled" and "static":

- Uninstalled builds resolve all external files at runtime using the `MAGICK_HOME` environment variable, rather than
  having paths hardcoded into the binaries. This allows `magick` to run from the plugin's directory (which is unknown)
  rather than requiring `magick` to be installed to a fixed location. See: https://imagemagick.org/script/resources.php

- Static builds have all "delegate libraries" built into them, rather than requiring them as shared libraries provided
  by the operating system.

This binary is built against Amazon Linux 2, 64-bit (ARM).

## Instructions

To rebuild the `result/bin/magick` binary:

```shell
make clean
make
```

(Note: it takes about ~~15 minutes~~ 70 minutes since adding `--platform linux/arm64/v8`!)

## Credit

https://github.com/serverlesspub/imagemagick-aws-lambda-2
