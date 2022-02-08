/* eslint @typescript-eslint/no-var-requires: 0 */
const path = require("path");
const WebpackShellPluginNext = require("webpack-shell-plugin-next");
const packageJson = require("./package.json");
const isProduction = false;
const { promises: fsAsync } = require("fs");

const externals = {
  sharp: "commonjs sharp"
};

const npmInstallOptions = {
  sharp: `--arch=arm64 --platform=linux sharp@${packageJson.dependencies.sharp}`
};

module.exports = {
  entry: "./src/index.ts",
  output: {
    libraryExport: "default",
    libraryTarget: "umd"
  },
  mode: isProduction ? "production" : "development",
  devtool: false,
  stats: "minimal",
  plugins: [
    new WebpackShellPluginNext({
      onBuildEnd: {
        scripts: [
          "./runInDistDir.sh npm init -y",
          ...Object.keys(externals).map(
            packageName => `./runInDistDir.sh npm install ${npmInstallOptions[packageName] || packageName}`
          ),
          async () => {
            // We need to remove the 'files' field from Sharp's package.json, else its native binaries will be excluded
            // from the bundle produced by 'npm pack'.
            const sharpPackageJsonPath = "dist/node_modules/sharp/package.json";
            const sharpPackageJson = JSON.parse(
              (await fsAsync.readFile(path.resolve(sharpPackageJsonPath))).toString()
            );
            delete sharpPackageJson.files;
            await fsAsync.writeFile(sharpPackageJsonPath, JSON.stringify(sharpPackageJson));
          }
        ],
        blocking: true,
        parallel: false
      }
    })
  ],
  externals,
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
