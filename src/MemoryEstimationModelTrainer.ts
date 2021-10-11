/**
 * Run using: 'npm run train'
 *
 * This program is used to generate values for 'MemoryEstimationModel.modelParameters' from a set of training data.
 */
import { sortBy, sum } from "ramda";
import { MemoryEstimationModel } from "upload-image-plugin/MemoryEstimationModel";
import { MemoryEstimationModelParameters } from "upload-image-plugin/types/MemoryEstimationModelParameters";

/**
 * Training data generated with JPF (JPEG 2000) files, as these seem to be one of the most space-hungry formats:
 *
 *    /usr/bin/time -f %M ./magick images/09356268.jpf -resize 800x600 jpf:output
 *
 * Note: run the above command (and collect the output from) the same EC2 instance type used in PROD: environments make
 * a big difference on memory usage, so we want the training data to be representative.
 *
 * In future, we will generate a set of model parameters per format. I.e. train the model like we are below, but with
 * a training set per format, and store the results in a map keyed off the format (treating the format as a feature of
 * the model, essentially).
 */
const trainingData = [
  { actualUsedKB: 16616, inputPixels: 212268, outputPixels: 270000 },
  { actualUsedKB: 20112, inputPixels: 212268, outputPixels: 367500 },
  { actualUsedKB: 23680, inputPixels: 212268, outputPixels: 480000 },
  { actualUsedKB: 27812, inputPixels: 212268, outputPixels: 607500 },
  { actualUsedKB: 31676, inputPixels: 212268, outputPixels: 750000 },
  { actualUsedKB: 102912, inputPixels: 212268, outputPixels: 3000000 },
  { actualUsedKB: 220228, inputPixels: 212268, outputPixels: 6750000 },
  { actualUsedKB: 63276, inputPixels: 798768, outputPixels: 1687500 },
  { actualUsedKB: 104208, inputPixels: 798768, outputPixels: 3000000 },
  { actualUsedKB: 222376, inputPixels: 798768, outputPixels: 6750000 },
  { actualUsedKB: 385796, inputPixels: 798768, outputPixels: 12000000 },
  { actualUsedKB: 595852, inputPixels: 798768, outputPixels: 18750000 },
  { actualUsedKB: 116544, inputPixels: 1760268, outputPixels: 3307500 },
  { actualUsedKB: 267640, inputPixels: 1760268, outputPixels: 8167500 },
  { actualUsedKB: 446360, inputPixels: 1760268, outputPixels: 13867500 },
  { actualUsedKB: 669332, inputPixels: 1760268, outputPixels: 21067500 },
  { actualUsedKB: 937728, inputPixels: 1760268, outputPixels: 29767500 },
  { actualUsedKB: 172224, inputPixels: 3096768, outputPixels: 5070000 },
  { actualUsedKB: 318340, inputPixels: 3096768, outputPixels: 9720000 },
  { actualUsedKB: 505852, inputPixels: 3096768, outputPixels: 15870000 },
  { actualUsedKB: 743836, inputPixels: 3096768, outputPixels: 23520000 },
  { actualUsedKB: 1027184, inputPixels: 3096768, outputPixels: 32670000 },
  { actualUsedKB: 182568, inputPixels: 4808268, outputPixels: 5070000 },
  { actualUsedKB: 224356, inputPixels: 4808268, outputPixels: 6750000 },
  { actualUsedKB: 388544, inputPixels: 4808268, outputPixels: 12000000 },
  { actualUsedKB: 598368, inputPixels: 4808268, outputPixels: 18750000 },
  { actualUsedKB: 852792, inputPixels: 4808268, outputPixels: 27000000 },
  { actualUsedKB: 256704, inputPixels: 6894768, outputPixels: 7207500 },
  { actualUsedKB: 301208, inputPixels: 6894768, outputPixels: 9187500 },
  { actualUsedKB: 388352, inputPixels: 6894768, outputPixels: 12000000 },
  { actualUsedKB: 598904, inputPixels: 6894768, outputPixels: 18750000 },
  { actualUsedKB: 852424, inputPixels: 6894768, outputPixels: 27000000 },
  { actualUsedKB: 344996, inputPixels: 9356268, outputPixels: 9720000 },
  { actualUsedKB: 388388, inputPixels: 9356268, outputPixels: 12000000 },
  { actualUsedKB: 598404, inputPixels: 9356268, outputPixels: 18750000 },
  { actualUsedKB: 851816, inputPixels: 9356268, outputPixels: 27000000 },
  { actualUsedKB: 1153392, inputPixels: 9356268, outputPixels: 36750000 },
  { actualUsedKB: 445492, inputPixels: 12192768, outputPixels: 12607500 },
  { actualUsedKB: 489684, inputPixels: 12192768, outputPixels: 15187500 },
  { actualUsedKB: 597560, inputPixels: 12192768, outputPixels: 18750000 },
  { actualUsedKB: 850400, inputPixels: 12192768, outputPixels: 27000000 },
  { actualUsedKB: 1151172, inputPixels: 12192768, outputPixels: 36750000 }
];

interface Metric {
  end: number;
  start: number;
  step: number;
}

const spaceCoefficients: Metric = {
  start: 0.024,
  end: 0.034,
  step: 0.0001
};
const spaceConstants: Metric = {
  // Makes naff-all difference when you get into large image sizes!
  start: 0,
  end: 100000,
  step: 10000
};
const shareCoefficients: Metric = {
  start: 0.3,
  end: 1,
  step: 0.005
};
const shareConstants: Metric = {
  // Makes naff-all difference when you get into large image sizes!
  start: 0,
  end: 10000000,
  step: 500000
};

function generateParams(metric: Metric): number[] {
  if (metric.end === metric.start) {
    return [metric.end];
  }

  const variations = Math.ceil((metric.end - metric.start) / metric.step);

  return [...Array(variations).keys()].map(step => metric.start + metric.step * step);
}

function runTrainer(): void {
  const spaceCoefficientVals = generateParams(spaceCoefficients);
  const spaceConstantVals = generateParams(spaceConstants);
  const shareCoefficientVals = generateParams(shareCoefficients);
  const shareConstantVals = generateParams(shareConstants);

  let testCurrent = 0;
  const testCount =
    spaceCoefficientVals.length * spaceConstantVals.length * shareCoefficientVals.length * shareConstantVals.length;

  const results = spaceCoefficientVals.flatMap(spaceCoefficient =>
    spaceConstantVals.flatMap(spaceConstant =>
      shareCoefficientVals.flatMap(shareCoefficient =>
        shareConstantVals.flatMap(shareConstant => {
          testCurrent++;
          if (testCurrent % 100 === 0) {
            console.log(`${Math.round((testCurrent / testCount) * 100)}% complete...`);
          }

          const modelParameters: MemoryEstimationModelParameters = {
            spaceCoefficient,
            spaceConstant,
            shareCoefficient,
            shareConstant
          };
          const freeSpace = trainingData.map(
            x => MemoryEstimationModel.getEstimateInKB(x.inputPixels, x.outputPixels, modelParameters) - x.actualUsedKB
          );
          const paramsSucceeded = freeSpace.every(x => x >= 0); // Params failed if caused underestimation.
          const wastedSpaceKB = sum(freeSpace); // Cost is free space: the lower the better.
          return paramsSucceeded ? [{ wastedSpaceKB, modelParameters }] : [];
        })
      )
    )
  );

  if (results.length === 0) {
    console.log("No viable params.");
  } else {
    const { modelParameters, wastedSpaceKB } = sortBy(x => x.wastedSpaceKB, results)[0];

    console.log("");
    console.log(`Optimal params: ${JSON.stringify(modelParameters)}`);
    console.log(`Total overestimation (lower is better): ${wastedSpaceKB} KB`);
    console.log("");
    console.log("Please save these values to: MemoryEstimationModel.modelParameters");
    console.log("");
  }
}

runTrainer();
