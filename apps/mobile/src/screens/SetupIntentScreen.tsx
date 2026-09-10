import { useTranslation } from '../app/i18n.js';
import type { SetupIntent } from '../flows/setup-intent.js';

type SetupIntentScreenProps = {
  onSelect(intent: SetupIntent): void;
  onCancel?(): void;
  showManage?: boolean;
};

const INTENT_CHOICES = [
  {
    id: 'temperature',
    titleKey: 'intent.temperature.title',
    descriptionKey: 'intent.temperature.description'
  },
  {
    id: 'humidity',
    titleKey: 'intent.humidity.title',
    descriptionKey: 'intent.humidity.description'
  },
  {
    id: 'time',
    titleKey: 'intent.time.title',
    descriptionKey: 'intent.time.description'
  },
  {
    id: 'manage',
    titleKey: 'intent.manage.title',
    descriptionKey: 'intent.manage.description'
  }
] as const;

export const SetupIntentScreen = ({
  onSelect,
  onCancel,
  showManage = true
}: SetupIntentScreenProps) => {
  const { t } = useTranslation();

  return (
    <main className="demo-shell intent-shell">
      {onCancel && (
        <div className="setup-context">
          <button className="setup-context__back" type="button" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      )}

      <header className="demo-header intent-header">
        <div>
          <h1>{t('intent.title')}</h1>
        </div>
      </header>

      <section className="intent-choice-grid" aria-label={t('intent.choiceLabel')}>
        {INTENT_CHOICES.filter((choice) => showManage || choice.id !== 'manage').map(
          (choice) => (
            <button
              key={choice.id}
              className="intent-choice"
              type="button"
              onClick={() => onSelect(choice.id)}
            >
              <span className="intent-choice__copy">
                <strong>{t(choice.titleKey)}</strong>
                <span>{t(choice.descriptionKey)}</span>
              </span>
              <span className="intent-choice__action" aria-hidden="true">
                ›
              </span>
            </button>
          )
        )}
      </section>
    </main>
  );
};
