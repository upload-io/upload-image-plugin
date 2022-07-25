# Upload Image Plugin

Resizes, crops, and converts images for Upload.io's [Image Upload API](https://upload.io/image-upload-api).

To use this plugin use the following settings in a "Transformation Step" in the Upload Dashboard:

| Plugin Name           | Plugin Version |
| --------------------- | -------------- |
| `upload-image-plugin` | `2.7.0`        |

## Development

On Linux there's nothing to install: the plugin resolves `image-magick` to `.bin/magick` (included in this repository).

On macOS you need to install:

```bash
brew install imagemagick
```

## License

[MIT](LICENSE)
