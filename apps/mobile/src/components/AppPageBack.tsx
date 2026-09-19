import type { ReactNode } from 'react';

type AppPageBackProps = {
  context?: ReactNode;
  label: string;
  onBack(): void;
};

export const AppPageBack = ({ context, label, onBack }: AppPageBackProps) => (
  <div className="setup-context app-page-back-row">
    <button className="setup-context__back" type="button" onClick={onBack}>
      ‹ {label}
    </button>
    {context !== undefined && <strong>{context}</strong>}
  </div>
);
