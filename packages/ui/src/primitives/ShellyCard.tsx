import { StatusBadge, type StatusTone } from '../feedback/StatusBadge.js';

export interface ShellyCardProps {
  name: string;
  model: string;
  badgeLabel: string;
  badgeTone: StatusTone;
  rows: Array<{
    label: string;
    value: string;
  }>;
}

export const ShellyCard = ({
  name,
  model,
  badgeLabel,
  badgeTone,
  rows
}: ShellyCardProps) => (
  <article className="lcl-compact-device">
    <div className="lcl-compact-device__header">
      <strong>{name}</strong>
      <span>{model}</span>
      <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
    </div>
    <dl className="lcl-compact-rows">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  </article>
);
