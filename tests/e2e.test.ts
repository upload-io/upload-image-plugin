import plugin from "upload-image-plugin";
import { Transformation, FunctionInvocationFilePaths } from "upload-plugin-sdk";
import path from "path";
import { promises as fsAsync } from "fs";

const tmpDirRoot = path.join(__dirname, "../.tmp/tests/e2e");
const tmpDir1 = path.join(tmpDirRoot, "1");
const tmpDir2 = path.join(tmpDirRoot, "2");

describe("Compress & Decompress", () => {
  test("Compress a file into an archive and decompress it back to the same file", async () => {
    await beforeTest();
    const inputFile = path.join(__dirname, "assets/input.txt");
    const outputFile = await compress(inputFile);
    const decompressedFolder = await decompress(outputFile);
    const decompressedFile = path.join(decompressedFolder, "file.txt");
    const expectedContent = await fsAsync.readFile(inputFile);
    const actualContent = await fsAsync.readFile(decompressedFile);
    expect(expectedContent.equals(actualContent)).toBe(true);
  });
});

describe("Decompress", () => {
  test("Decompress a 60MB ZIP (230 files @ 162MB decompressed)", async () => {
    await beforeTest();
    const inputFile = path.join(__dirname, "assets/ffmpeg-git-amd64-static.zip");
    const decompressedFolder = await decompress(inputFile);
    const decompressedFile = path.join(decompressedFolder, "ffmpeg-git-20210908-amd64-static/readme.txt");
    let decompressedFileExists: boolean;
    try {
      await fsAsync.access(decompressedFile);
      decompressedFileExists = true;
    } catch (e) {
      decompressedFileExists = false;
    }
    expect(decompressedFileExists).toBe(true);
  });
});

async function compress(filePath: string): Promise<string> {
  const transformation: Transformation = {
    type: "Transformation",
    artifact: "foo",
    definition: {
      id: "zip",
      slug: "zip",
      description: "zip",
      cacheId: "zip",
      steps: [
        {
          plugin: {
            packageAuthors: ["upload-io"],
            packageVersion: "0.0.3",
            packageName: "upload-image-plugin"
          },
          params: {
            mode: "archive",
            settings: {
              compressionLevel: 9,
              format: "zip"
            }
          },
          isAsync: false
        }
      ],
      scope: {
        mime: ["*"],
        tag: ["*"]
      }
    },
    file: {
      size: 3,
      fileId: "A623uY9wEthFx98k",
      mime: "text/plain",
      accountId: "A623uY9",
      name: undefined,
      tags: [],
      uploadedAt: 0
    },
    requestId: "01ES2K518RPED2V6SBSWATEVBG"
  };
  const paths: FunctionInvocationFilePaths = {
    apexFileDir: path.join(tmpDir1, "apex/"),
    namedFileDir: path.join(tmpDir1, "named/"),
    originalFile: path.join(tmpDir1, "apex/index")
  };
  await fsAsync.mkdir(paths.apexFileDir);
  await fsAsync.mkdir(paths.namedFileDir);
  await fsAsync.copyFile(filePath, paths.originalFile);
  await plugin({
    transformation,
    step: transformation.definition.steps[0],
    paths,
    type: "TransformationStep",
    previousAsyncSteps: []
  });

  return paths.originalFile;
}

async function beforeTest(): Promise<void> {
  await fsAsync.rmdir(tmpDirRoot, { recursive: true });
  await fsAsync.mkdir(tmpDirRoot, { recursive: true });
  await fsAsync.mkdir(tmpDir1);
  await fsAsync.mkdir(tmpDir2);
}

async function decompress(filePath: string): Promise<string> {
  const transformation: Transformation = {
    type: "Transformation",
    artifact: "foo",
    definition: {
      id: "zip",
      slug: "zip",
      description: "zip",
      cacheId: "zip",
      steps: [
        {
          plugin: {
            packageAuthors: ["upload-io"],
            packageVersion: "0.0.3",
            packageName: "upload-image-plugin"
          },
          params: {
            mode: "extract"
          },
          isAsync: false
        }
      ],
      scope: {
        mime: ["*"],
        tag: ["*"]
      }
    },
    file: {
      size: 3,
      fileId: "A623uY9wEthFx98k",
      mime: "text/plain",
      accountId: "A623uY9",
      name: undefined,
      tags: [],
      uploadedAt: 0
    },
    requestId: "01ES2K518RPED2V6SBSWATEVBG"
  };
  const paths: FunctionInvocationFilePaths = {
    apexFileDir: path.join(tmpDir2, "apex/"),
    namedFileDir: path.join(tmpDir2, "named/"),
    originalFile: path.join(tmpDir2, "apex/index")
  };
  await fsAsync.mkdir(paths.apexFileDir);
  await fsAsync.mkdir(paths.namedFileDir);
  await fsAsync.copyFile(filePath, paths.originalFile);
  await plugin({
    transformation,
    step: transformation.definition.steps[0],
    paths,
    type: "TransformationStep",
    previousAsyncSteps: []
  });

  return paths.namedFileDir;
}
