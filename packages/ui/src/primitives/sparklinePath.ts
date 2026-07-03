export type SparklineDomain = {
  minimumRange?: number;
  lowerBound?: number;
  upperBound?: number;
};

export type SparklinePoint = number | null | undefined;

export type ResolvedSparklineDomain = {
  min: number;
  max: number;
};

export const SPARKLINE_VIEWBOX_WIDTH = 100;
export const SPARKLINE_VIEWBOX_HEIGHT = 28;
export const SPARKLINE_EDGE_PADDING = 1;

const DEFAULT_MINIMUM_RANGE = 1;
const MINIMUM_DOMAIN_RANGE = 0.0001;

export const finiteSparklinePoints = (points: SparklinePoint[]): number[] =>
  points.filter(
    (point): point is number => typeof point === 'number' && Number.isFinite(point)
  );

const clampDomainToBounds = (
  min: number,
  max: number,
  lowerBound: number | undefined,
  upperBound: number | undefined
): ResolvedSparklineDomain => {
  let adjustedMin = min;
  let adjustedMax = max;

  if (lowerBound !== undefined && adjustedMin < lowerBound) {
    adjustedMax += lowerBound - adjustedMin;
    adjustedMin = lowerBound;
  }

  if (upperBound !== undefined && adjustedMax > upperBound) {
    adjustedMin -= adjustedMax - upperBound;
    adjustedMax = upperBound;
  }

  if (lowerBound !== undefined && adjustedMin < lowerBound) {
    adjustedMin = lowerBound;
  }

  if (upperBound !== undefined && adjustedMax > upperBound) {
    adjustedMax = upperBound;
  }

  if (adjustedMax - adjustedMin < MINIMUM_DOMAIN_RANGE) {
    adjustedMax = adjustedMin + MINIMUM_DOMAIN_RANGE;
  }

  return { min: adjustedMin, max: adjustedMax };
};

export const resolveSparklineDomain = (
  points: number[],
  domain: SparklineDomain = {}
): ResolvedSparklineDomain | null => {
  if (points.length === 0) {
    return null;
  }

  const rawMin = Math.min(...points);
  const rawMax = Math.max(...points);
  const minimumRange = Math.max(
    domain.minimumRange ?? DEFAULT_MINIMUM_RANGE,
    MINIMUM_DOMAIN_RANGE
  );
  const range = rawMax - rawMin;

  if (range >= minimumRange) {
    return clampDomainToBounds(rawMin, rawMax, domain.lowerBound, domain.upperBound);
  }

  const midpoint = (rawMin + rawMax) / 2;
  const halfRange = minimumRange / 2;
  return clampDomainToBounds(
    midpoint - halfRange,
    midpoint + halfRange,
    domain.lowerBound,
    domain.upperBound
  );
};

export const createSparklinePath = (
  points: number[],
  domain?: SparklineDomain
): string => {
  const resolvedDomain = resolveSparklineDomain(points, domain);
  if (!resolvedDomain) {
    return '';
  }

  const yForPoint = (point: number): number => {
    const range = resolvedDomain.max - resolvedDomain.min || MINIMUM_DOMAIN_RANGE;
    const normalized = (point - resolvedDomain.min) / range;
    return (
      SPARKLINE_EDGE_PADDING +
      (1 - normalized) * (SPARKLINE_VIEWBOX_HEIGHT - SPARKLINE_EDGE_PADDING * 2)
    );
  };

  if (points.length === 1) {
    const y = yForPoint(points[0]!);
    return `M ${SPARKLINE_EDGE_PADDING.toFixed(2)} ${y.toFixed(2)} L ${(SPARKLINE_VIEWBOX_WIDTH - SPARKLINE_EDGE_PADDING).toFixed(2)} ${y.toFixed(2)}`;
  }

  const xStep =
    (SPARKLINE_VIEWBOX_WIDTH - SPARKLINE_EDGE_PADDING * 2) / (points.length - 1);

  return points
    .map((point, index) => {
      const x = SPARKLINE_EDGE_PADDING + index * xStep;
      const y = yForPoint(point);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};
