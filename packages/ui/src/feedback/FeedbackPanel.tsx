import type { ReactNode } from 'react';

export type FeedbackPanelTone = 'warning' | 'danger';

export interface FeedbackPanelProps {
  tone: FeedbackPanelTone;
  title: string;
  children?: ReactNode;
}

export const FeedbackPanel = ({ tone, title, children }: FeedbackPanelProps) => (
  <section className={`lcl-feedback-panel lcl-feedback-panel--${tone}`}>
    <strong>{title}</strong>
    {children && <p>{children}</p>}
  </section>
);
