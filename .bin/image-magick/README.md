# ImageMagick Manual Build

This folder builds an ImageMagick binary that runs on Amazon Linux 2. The only dependencies on shared libraries are
those that come preinstalled on Amazon Linux 2: the rest are statically built into the binary.

## Instructions

To rebuild the `bin/magick` binary:

```shell
make
```

(Note: it takes about 10 minutes!)

## Credit

https://github.com/serverlesspub/imagemagick-aws-lambda-2
