import {
  IconListDetails,
  IconPlug,
  IconSettings,
  IconTemperature
} from '@tabler/icons-react';
import { useTranslation } from '../app/i18n.js';
import './AppBottomNavigation.css';

export type AppNavigationKind = 'rules' | 'plugs' | 'sensors' | 'settings';
const entries = [
  { id: 'plugs', icon: IconPlug, label: 'navigation.plugs' },
  { id: 'sensors', icon: IconTemperature, label: 'navigation.sensors' },
  { id: 'rules', icon: IconListDetails, label: 'navigation.rules' },
  { id: 'settings', icon: IconSettings, label: 'dashboard.settingsTab' }
] as const;
export const AppBottomNavigation = ({
  activeKind,
  onNavigate
}: {
  activeKind: AppNavigationKind;
  onNavigate(kind: AppNavigationKind): void;
}) => {
  const { t } = useTranslation();
  return (
    <nav
      className="dashboard-bottom-nav app-bottom-nav"
      aria-label={t('dashboard.systemsLabel')}
    >
      {entries.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className="dashboard-bottom-nav__item app-bottom-nav__item"
          type="button"
          aria-current={activeKind === id ? 'page' : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon className="dashboard-nav__icon app-bottom-nav__icon" aria-hidden="true" />
          <span>{t(label)}</span>
        </button>
      ))}
    </nav>
  );
};
