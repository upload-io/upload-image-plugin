# Upload Image Plugin

Resize, crop, and convert images on [Upload](https://upload.io).

To use this plugin use the following settings in a "Transformation Step" in the Upload Dashboard:

| Plugin Name           | Plugin Version |
| --------------------- | -------------- |
| `upload-image-plugin` | `1.29.0`       |

## Development

On Linux there's nothing to install: the plugin resolves `image-magick` to `.bin/magick` (included in this repository).

On macOS you need to install:

```bash
brew install imagemagick
```

## License

[MIT](LICENSE)
