export interface ModelParameterRange {
  end: number;
  start: number;
  step: number;
}

export namespace ModelParameterRange {
  export function generateRange(metric: ModelParameterRange): number[] {
    if (metric.end === metric.start) {
      return [metric.end];
    }

    const variations = Math.ceil((metric.end - metric.start) / metric.step);

    return [...Array(variations).keys()].map(step => metric.start + metric.step * step);
  }
}
