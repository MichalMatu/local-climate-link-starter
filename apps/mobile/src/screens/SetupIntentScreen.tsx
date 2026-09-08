import { useTranslation } from '../app/i18n.js';
import type { SetupIntent } from '../flows/setup-intent.js';

type SetupIntentScreenProps = {
  onSelect(intent: SetupIntent): void;
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

export const SetupIntentScreen = ({ onSelect }: SetupIntentScreenProps) => {
  const { t } = useTranslation();

  return (
    <main className="demo-shell intent-shell">
      <header className="demo-header intent-header">
        <div>
          <p className="demo-kicker">Local Climate Link</p>
          <h1>{t('intent.title')}</h1>
          <p>{t('intent.description')}</p>
        </div>
      </header>

      <section className="intent-choice-grid" aria-label={t('intent.choiceLabel')}>
        {INTENT_CHOICES.map((choice) => (
          <button
            key={choice.id}
            className="intent-choice"
            type="button"
            onClick={() => onSelect(choice.id)}
          >
            <strong>{t(choice.titleKey)}</strong>
            <span>{t(choice.descriptionKey)}</span>
            <span className="intent-choice__action" aria-hidden="true">
              {t('intent.open')}
            </span>
          </button>
        ))}
      </section>
    </main>
  );
};
