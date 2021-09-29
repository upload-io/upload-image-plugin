# ImageMagick Manual Build

Creates an "uninstalled" and "static" build of ImageMagick:

- uninstalled builds do not have their location hard-coded or set by an installer, and instead rely on the `MAGICK_HOME`
  environment variable to inform ImageMagick where it's currently running.

- static builds have all "delegate libraries" built into them, rather than requiring them as shared libraries provided
  by the operating system.

We build against Amazon Linux 2.

## Instructions

To rebuild the `bin/magick` binary:

```shell
make
```

(Note: it takes about 10 minutes!)

## Credit

https://github.com/serverlesspub/imagemagick-aws-lambda-2
