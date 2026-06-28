export type StatusTone = 'ok' | 'warning' | 'danger' | 'inactive';

export interface StatusBadgeProps {
  tone: StatusTone;
  children: string;
}

export const StatusBadge = ({ tone, children }: StatusBadgeProps) => (
  <span className={`lcl-status-badge lcl-status-badge--${tone}`}>{children}</span>
);
