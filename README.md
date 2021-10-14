# Upload Compression Plugin

Compress and decompress files on [Upload](https://upload.io).

To use this plugin use the following settings in a "Transformation Step" in the Upload Dashboard:

| Plugin Name           | Plugin Version |
| --------------------- | -------------- |
| `upload-image-plugin` | `1.25.6`       |

## Development

On Linux there's nothing to install: the plugin resolves `image-magick` to `.bin/magick` (included in this repository).

On macOS you need to install:

```bash
brew install imagemagick
```

## ImageMagick memory requirements

ImageMagick requires N bytes of "space" to process an image, which is a function of the input image and the transformation.

### Where does ImageMagick allocate space?

ImageMagick allocates space across tranches, but will try to keep within the upper tranche(s) if possible. ImageMagick
will spill into a subsequent tranche after filling the current one, e.g. if 90MB of space is required, ImageMagick may
allocate 30MB in RSS, 30MB in CACHE and 30MB in DISK.

The order of precedent is as follows:

1. RSS (incredibly fast).

   Note: there is a minimum RSS ImageMagick requires for a given transformation, and is a
   function of the input image and the transformation. This cannot be lowered with `-limit`.

2. CACHE (very fast).

3. DISK (very slow).

ImageMagick does not knowingly allocate memory to CACHE(2): this type of allocation occurs when ImageMagick allocates to
DISK(3), but the OS transparently allocates to CACHE(2) instead, as it sees enough free RAM is available (e.g. within
the cgroup) to prevent going to DISK(3).

Empirically we've found CACHE(2) adds a 100% time penaly, whereas DISK adds a 2500% time penalty, compared to storing in
RSS(1).

### What's the minimum RSS ImageMagick requires?

There's a theoretical and a practical answer to this question:

Theoretically you can measure the minimum RSS ImageMagick requires by running:

```shell
> /usr/bin/time -f %M ./magick input.jpg -resize 400 png:output
< 462112
> /usr/bin/time -f %M ./magick -limit memory 0 -limit map 0 input.jpg -resize 400 png:output
< 96848
```

The first command tells you the total space ImageMagick requires for the transformation.

The second command tells you the peak RSS ImageMagick used when instructed to use as little RSS as possible (by passing
the `-limit memory 0 -limit map 0` options).

Here we can see ImageMagick requires 451MB space, and a minimum of 95MB RSS.

However: peak RSS is only the theoretical answer!

The practical answer must account for memory fragmentation, and particularly memory fragmentation with respect to
running processes within cgroups.

Cgroups appear to bind themselves to specific block(s) of memory when `memory.limit_in_bytes` is set. Sometimes the
block(s) come more fragmented than other times, such that given several cgroups each with the same
`memory.limit_in_bytes`, one cgroup can consistently fail to run ImageMagick, whereas another can consistently succeed
to run ImageMagick.

Furthermore, as ImageMagick runs it will further-fragment this limited number of blocks.

Since ImageMagick requires large blocks of contigious memory, it will OOM when the cgroup's blocks become (or start)
fragmented.

**We've found a safe lowerbound for `memory.limit_in_bytes` is 3x the peak RSS of ImageMagick.**

### How much `memory.limit_in_bytes` should I give the cgroup?

The previous section answered the _minimum_, but the _ideal_ is actually the total space ImageMagick requires.

Granting any less than the total space required (i.e. 451MB in the above example) will cause ImageMagick to spill into
DISK, which comes with a 2500% time penalty compared to RSS.

We always want DISK to be `0`.

We also want CACHE to be `0`, since intentionally using CACHE is nonsensical as is equivalent to saying "I know the cgroup has memory available
for RSS, but I'd like to use that memory for CACHE instead, which is 2x slower".

Since DISK must be `0`, and CACHE must be `0`, that means we must plan for everything to fit into RSS.

The value of `memory.limit_in_bytes` must therefore be equal to (or a little higher than) the output of
`/usr/bin/time -f %M ./magick ...args-without-limit-flags...` multiplied by 1024.

### Should I still set a `-limit` to be safe?

It's a nice idea, but useless in practice.

The `-limit` flag cannot be used to set a precise limit on a resource.

Rather, for a given resource like `-limit memory` there will be a handful of discrete intervals of memory usage
ImageMagick will abide, and worse yet: ImageMagick appears to pick the closest one, so may round your `-limit` up by
several hundred MBs.

For example, the transformation we use in this README requires 451MB of space. Using the `-limit memory` options, we're
able to limit RSS to 95MB, 100MB and 451MB (unlimited). When we specify `-limit memory 400MiB`, ImageMagick actually
rounds-up and picks the "unlimited memory" option, reporting a peak RSS of 451MB.

So no, you shouldn't set the `-limit` option as it's unlikely to help prevent you overshooting the cgroup's limits if
your estimation is off by a few MB: ImageMagick will just round-up to the unlimited memory usage option.

### How do I estimate the space required by an ImageMagick command?

It's difficult to produce an equation that exactly estimates how much space ImageMagick requires (to support this: the space required also depends on the environment you're running ImageMagick on -- see "Different environments == different results" -- so the exact equation is likely to be very complex, involving many variables about the system itself, let alone the image).

Instead, we estimate ImageMagick's space requirements for a given command ahead of time using a linear regression model.

Our linear regression takes a sample of images in various formats and sizes, and uses the peak RSS as the continuous label with the pixel count as its only feature.

_Note: in future we can optimise memory usage by adding additional features: format would be an obvious one (JPEG 2000 images require double the space of JPEG images with baseline compression). This would allow us to reduce overestimations while still preventing underestimations._

Since we want to avoid underestimating memory at all costs (as this will result in an OOM), we adjust the regression line such that all observations fit beneath it. This means we will overestimate space requirements for some images, but hopefully never underestimate.

```
space_required = constant + pixel_count * coefficient
```

#### Building a linear model for the input

We start with resize & transcode operation, outputting to a small 1 pixel image, just to remove the output image's dimensions from the equation (we'll focus on this separately):

```
/usr/bin/time -f %M:%e ./magick input.jpg -resize 1 png:output
```

We then create our initial samples: many image formats, but with the same number of pixels, just to identify the most expensive format.

> Our findings show that JPEG 2000 (JPF) images require the most space, when compared to JPG, JPS, PNG, HEIC and GIF.

We then create more samples: many images with different dimensions, all as lossless JPEG 2000 (as this seems to be the largest format).

> Our findings show a perfectly linear relationship between pixel count and space required.

The linear regression line is as follows (`y` is space required in KB, `x` is pixel count):

```
y = 0.0249x + 16105
```

We then adjust the constant to ensure all our samples fall below the line. The updated equation is:

```
y = 0.0249x + 21000
```

This gives us a good estimation for transcoding and resizing images to 1-pixel PNGs!

Now we need to consider the space required for the output...

#### Building a linear model for the output

Our findings show that if the output image size is sufficiently smaller than the input image, no additional space is
required. Beyond a certain point, space is acquired linearly as before.

We found that where `x` is the input image's pixel count, if the output image's pixel count stays below `y` then no
additional space is required:

```
y = 0.4058x + 525009
```

If the output pixels exceed `y`, we take the difference and pass it through our linear function for determining space
required for input images, above.

#### Putting it all together:

```
space_required_for_input_kb = 0.0249 * input_pixel_count + 21000

pixels_shared_with_output = 0.4058 * input_pixel_count + 525009

space_required_for_output_kb = max(0, 0.0249 * (output_pixel_count - pixels_shared_with_output) + 21000)

space_required_kb = space_required_for_input_kb + space_required_for_output_kb
```

**UPDATE: we have adapted this model slightly, see `MemoryEstimationModel`.**

### Experiments

To run these experiments:

1. Launch a `r6gd.medium` (ARM) and SSH into it.
2. Download ImageMagick (the exact same binary used by this plugin):
   ```shell
   sudo su &&\
   cd &&\
   curl https://registry.npmjs.org/upload-image-plugin/-/upload-image-plugin-1.23.5.tgz -o upload-image-plugin.tgz &&\
   tar -xf upload-image-plugin.tgz &&\
   cd package/.bin/image-magick/result/bin
   ```
3. Install cgroup tools:
   ```shell
   yum -y install libcgroup libcgroup-tools
   ```
4. Download a test image (5.5MB JPEG @ 4958x6198):
   ```shell
   curl 'https://images.unsplash.com/photo-1534970028765-38ce47ef7d8d?ixlib=rb-1.2.1&amp;q=80&amp;fm=jpg&amp;crop=entropy&amp;cs=tinysrgb&amp;dl=trail-5yOnGsKUNGw-unsplash.jpg' \
   -o input.jpg
   ```

#### Obtaining the total space requirement

Simply run ImageMagick with no `-limit` arguments on a machine with ample memory, and observe its peak RSS usage:

```shell
> /usr/bin/time -f %M:%I:%e ./magick input.jpg -resize 400 png:output
< 462144:0:2.27
```

The result -- `462144` KB -- is the total amount of space ImageMagick requires for this transformation.

#### Forcing CACHE

We can force ImageMagick to use as little RSS as possible with `-limit memory 0 -limit map 0`.

ImageMagick will attempt to store the remaining space on DISK, but the OS will reroute to CACHE as there's ample free
memory (we give the cgroup 2000m of memory):

```shell
> cgcreate -g memory:image_magick
> cgset -r memory.limit_in_bytes=2000m -r memory.memsw.limit_in_bytes=2000m image_magick
> /usr/bin/time -f %M:%I:%e cgexec -g memory:image_magick ./magick -limit memory 0 -limit map 0 input.jpg -resize 400 png:output
> cat /sys/fs/cgroup/memory/image_magick/memory.max_usage_in_bytes
< 96828:0:4.61
< 462934016
```

The `memory.max_usage_in_bytes` metric reports RSS+CACHE, and states `462934016` bytes were used.

The GNU time command reports RSS only, and states `96828` KB were used.

Thus `355256` KB CACHE was used.

Also notice: we only paid a 100% time penality: 4.61 seconds vs 2.27 seconds from before. This is because CACHE is
essentially RAM.

#### Forcing DISK

We repeat the same experiment as above, except with a reduced cgroup limit.

There won't be enough free memory for the OS to use CACHE for everything that doesn't fit into RSS.
Consequently, part will go to RSS, part will go to CACHE, and the remainder will spill to DISK:

```shell
> cgcreate -g memory:image_magick
> cgset -r memory.limit_in_bytes=300m -r memory.memsw.limit_in_bytes=300m image_magick
> /usr/bin/time -f %M:%I:%e cgexec -g memory:image_magick ./magick -limit memory 0 -limit map 0 input.jpg -resize 400 png:output
> cat /sys/fs/cgroup/memory/image_magick/memory.max_usage_in_bytes
< 96712:1306704:31.81
< 299998976
```

Here we can see `1306704` "filesystem inputs" are now required, vs `0` from the previous two experiments.

This means ImageMagick is now spilling to DISK.

Also notice: we paid a whopping 1301% time penalty: 31.81 seconds vs 2.27 seconds from before. Further: only 33% of our
transformation spilled to DISK: if we spilled more to DISK, the time would be substantially higher.

### Different environments == different results

ImageMagick's peak RSS varies wildly between environments, even with the exact same ImageMagick binary, so it's
important to take your measurements on the exact environment the code will be running on.

To demonstrate the differences in ImageMagick's memory usage across environments, we run record the peak RSS of running
`magick -version`:

```shell
/usr/bin/time -f %M ./magick/bin/magick -version
```

Results:

| Environment                            | Binary              | Memory         |
| -------------------------------------- | ------------------- | -------------- |
| `docker run --platform linux/arm64/v8` | From this repo      | 14752 (14.7MB) |
| `t4g.nano`                             | From this repo      | 5436 (5.4MB)   |
| `r6gd.medium`                          | From this repo      | 5528 (5.5MB)   |
| macOS                                  | ImageMagick 7.1.0-8 | 3156 (3.1MB)   |
| `docker run dpokidov/imagemagick`      | ImageMagick 7.1.0-8 | 11952 (11.9MB) |

### Default `-limit` values

The default `-limit` ImageMagick infers is based on the machine's resources, not the container's resources or the
cgroup's resources. As such, even if you pass `--memory 456m --memory-swap 456m` to `docker run`, ImageMagick will still
assume the environment it's running in is as large as your machine (i.e. many GBs of available memory), and will set
large default limits.

Consequently, if you have set any `--memory` flags set, then these will cause the container's OOM Killer to kill
ImageMagick as it unwittingly oversteps the container's limits. The same applies for cgroups (ImageMagick sees the
host's resources, not the cgroups).

As an aside: on `t4g.nano`s often the EC2 instance's resources won't be large enough to accommodate an entire image in
memory, so ImageMagick will go to disk and RSS will stay relatively low as a result (5MB-20MB). As above, this behaviour
doesn't change with the process being run inside or outside a cgroup. Therefore, to get a feel of how much memory
ImageMagick _could_ use for a large image, run your experiments on a larger instance (e.g. `r6gd.medium`).

## License

[MIT](LICENSE)
