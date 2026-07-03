import {
  createSparklinePath,
  finiteSparklinePoints,
  SPARKLINE_VIEWBOX_HEIGHT,
  SPARKLINE_VIEWBOX_WIDTH,
  type SparklineDomain,
  type SparklinePoint
} from './sparklinePath.js';

export interface SparklineProps {
  label: string;
  points: SparklinePoint[];
  domain?: SparklineDomain;
}

export const Sparkline = ({ label, points, domain }: SparklineProps) => {
  const values = finiteSparklinePoints(points);
  const hasData = values.length >= 1;
  const path = hasData ? createSparklinePath(values, domain) : '';

  return (
    <svg
      aria-label={label}
      className={hasData ? 'lcl-sparkline' : 'lcl-sparkline lcl-sparkline--empty'}
      focusable="false"
      role="img"
      viewBox={`0 0 ${SPARKLINE_VIEWBOX_WIDTH} ${SPARKLINE_VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
    >
      {path && <path d={path} />}
    </svg>
  );
};
