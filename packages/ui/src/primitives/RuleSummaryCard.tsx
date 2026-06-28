import type { ReactNode } from 'react';

export interface RuleSummaryCardProps {
  action?: ReactNode;
  title: string;
  summary: string;
}

export const RuleSummaryCard = ({ action, title, summary }: RuleSummaryCardProps) => (
  <article className="lcl-card">
    <div className="lcl-card__header lcl-rule-summary__header">
      <h3>{title}</h3>
      {action && <div className="lcl-rule-summary__action">{action}</div>}
    </div>
    <p className="lcl-rule-copy">{summary}</p>
  </article>
);
