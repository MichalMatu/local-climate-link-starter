export interface SparklineProps {
  label: string;
  points: Array<number | null | undefined>;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 28;
const EDGE_PADDING = 2;

const finitePoints = (points: SparklineProps['points']): number[] =>
  points.filter(
    (point): point is number => typeof point === 'number' && Number.isFinite(point)
  );

const createPath = (points: number[]): string => {
  if (points.length === 0) {
    return '';
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xStep = (VIEWBOX_WIDTH - EDGE_PADDING * 2) / (points.length - 1);

  return points
    .map((point, index) => {
      const x = EDGE_PADDING + index * xStep;
      const y =
        EDGE_PADDING + (1 - (point - min) / range) * (VIEWBOX_HEIGHT - EDGE_PADDING * 2);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

export const Sparkline = ({ label, points }: SparklineProps) => {
  const values = finitePoints(points);
  const hasTrend = values.length >= 2;
  const path = hasTrend ? createPath(values) : '';

  return (
    <svg
      aria-label={label}
      className={hasTrend ? 'lcl-sparkline' : 'lcl-sparkline lcl-sparkline--empty'}
      focusable="false"
      role="img"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="none"
    >
      {path && <path d={path} />}
    </svg>
  );
};
