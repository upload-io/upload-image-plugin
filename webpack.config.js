/* eslint @typescript-eslint/no-var-requires: 0 */
const path = require("path");

const isProduction = false;

module.exports = {
  entry: "./src/index.ts",
  output: {
    libraryExport: "default",
    libraryTarget: "umd"
  },
  mode: isProduction ? "production" : "development",
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
