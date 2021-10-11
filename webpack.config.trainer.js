/* eslint @typescript-eslint/no-var-requires: 0 */
const path = require("path");

module.exports = {
  entry: "./src/training/index.ts",
  output: {
    libraryTarget: "commonjs2",
    path: path.resolve(__dirname, "dist-trainer"),
    filename: "Trainer.js"
  },
  mode: "development",
  devtool: false,
  stats: "minimal",
  plugins: [],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      // Remember to keep in sync with `tsconfig.json`
      "upload-image-plugin": path.resolve(__dirname, "src")
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "babel-loader" // Options are in 'babel.config.js'
          },
          {
            loader: "ts-loader"
          }
        ],
        include: [path.resolve(__dirname, "src")]
      }
    ]
  }
};
