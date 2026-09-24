import { IconChevronLeft } from '@tabler/icons-react';
import { useTranslation } from '../app/i18n.js';
import type { ReactNode } from 'react';

type AppPageBackProps = {
  context?: ReactNode;
  label: string;
  onBack(): void;
};

export const AppPageBack = ({ context, label, onBack }: AppPageBackProps) => {
  const { t } = useTranslation();
  return (
    <div className="setup-context app-page-back-row">
      <button
        className="setup-context__back"
        type="button"
        aria-label={`${t('common.back')}: ${label}`}
        onClick={onBack}
      >
        <IconChevronLeft className="app-page-back-row__icon" aria-hidden="true" />
        <span>{label}</span>
      </button>
      {context !== undefined && <strong>{context}</strong>}
    </div>
  );
};
