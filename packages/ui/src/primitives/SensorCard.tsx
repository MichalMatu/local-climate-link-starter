import { StatusBadge } from '../feedback/StatusBadge.js';

export interface SensorCardProps {
  name: string;
  profileLabel: string;
  statusLabel: string;
  metrics: Array<{
    label: string;
    value: string;
  }>;
}

export const SensorCard = ({
  name,
  profileLabel,
  statusLabel,
  metrics
}: SensorCardProps) => (
  <article className="lcl-card">
    <div className="lcl-card__header">
      <div>
        <h3>{name}</h3>
        <p>{profileLabel}</p>
      </div>
      <StatusBadge tone="ok">{statusLabel}</StatusBadge>
    </div>
    <dl className="lcl-metrics">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <dt>{metric.label}</dt>
          <dd>{metric.value}</dd>
        </div>
      ))}
    </dl>
  </article>
);
