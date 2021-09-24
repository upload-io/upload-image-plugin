const { pathsToModuleNameMapper } = require("ts-jest/utils"); // eslint-disable-line
const { compilerOptions } = require("./tsconfig.json"); // eslint-disable-line

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>/" }),
  setupFilesAfterEnv: ["<rootDir>/jest.config.pretest.js"]
};
