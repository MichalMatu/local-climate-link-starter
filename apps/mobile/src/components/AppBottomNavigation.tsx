import { IconClock, IconSettings, IconTemperature } from '@tabler/icons-react';
import { useTranslation } from '../app/i18n.js';
import './AppBottomNavigation.css';

export type AppNavigationKind = 'climate' | 'time';

type AppBottomNavigationProps = {
  activeKind: AppNavigationKind | 'settings';
  onOpenClimate(): void;
  onOpenTime(): void;
  onOpenSettings?: () => void;
};

export const AppBottomNavigation = ({
  activeKind,
  onOpenClimate,
  onOpenTime,
  onOpenSettings
}: AppBottomNavigationProps) => {
  const { t } = useTranslation();

  return (
    <nav
      className="dashboard-bottom-nav app-bottom-nav"
      aria-label={t('dashboard.systemsLabel')}
    >
      <button
        className="dashboard-bottom-nav__item app-bottom-nav__item"
        type="button"
        data-dashboard-kind="climate"
        aria-current={activeKind === 'climate' ? 'page' : undefined}
        onClick={onOpenClimate}
      >
        <IconTemperature
          className="dashboard-nav__icon app-bottom-nav__icon"
          aria-hidden="true"
        />
        <span>{t('dashboard.climateTab')}</span>
      </button>
      <button
        className="dashboard-bottom-nav__item app-bottom-nav__item"
        type="button"
        data-dashboard-kind="time"
        aria-current={activeKind === 'time' ? 'page' : undefined}
        onClick={onOpenTime}
      >
        <IconClock
          className="dashboard-nav__icon app-bottom-nav__icon"
          aria-hidden="true"
        />
        <span>{t('dashboard.timeTab')}</span>
      </button>
      <button
        className="dashboard-bottom-nav__item app-bottom-nav__item"
        type="button"
        data-dashboard-kind="settings"
        aria-current={activeKind === 'settings' ? 'page' : undefined}
        disabled={!onOpenSettings && activeKind !== 'settings'}
        onClick={() => onOpenSettings?.()}
      >
        <IconSettings
          className="dashboard-nav__icon app-bottom-nav__icon"
          aria-hidden="true"
        />
        <span>{t('dashboard.settingsTab')}</span>
      </button>
    </nav>
  );
};
