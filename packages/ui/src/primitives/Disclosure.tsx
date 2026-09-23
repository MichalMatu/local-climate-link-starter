import type { ReactNode } from 'react';
import './Disclosure.css';

export type DisclosureProps = {
  summary: ReactNode;
  summaryEnd?: ReactNode;
  children: ReactNode;
  className?: string;
};

export const Disclosure = ({
  summary,
  summaryEnd,
  children,
  className
}: DisclosureProps) => (
  <details className={className ? `lcl-disclosure ${className}` : 'lcl-disclosure'}>
    <summary className="lcl-disclosure__summary">
      {summary}
      <span className="lcl-disclosure__summary-end">
        {summaryEnd}
        <span className="lcl-disclosure__chevron" aria-hidden="true" />
      </span>
    </summary>
    <div className="lcl-disclosure__body">{children}</div>
  </details>
);
