import {
  IconBluetooth,
  IconCode,
  IconSettings,
  IconTemperature
} from '@tabler/icons-react';
import { useTranslation } from '../../../app/i18n.js';
import './PlugDetailTabs.css';

export type PlugDetailTab = 'automation' | 'ble' | 'device' | 'script' | 'info';

type PlugDetailTabsProps = {
  activeTab: PlugDetailTab;
  onChange(tab: PlugDetailTab): void;
};

const tabs: readonly {
  id: PlugDetailTab;
  labelKey:
    | 'detail.automation'
    | 'common.bluetooth'
    | 'hardware.shelly.settings'
    | 'hardware.rule.script'
    | 'common.info';
  icon: typeof IconTemperature | null;
}[] = [
  { id: 'automation', labelKey: 'detail.automation', icon: IconTemperature },
  { id: 'ble', labelKey: 'common.bluetooth', icon: IconBluetooth },
  { id: 'device', labelKey: 'hardware.shelly.settings', icon: IconSettings },
  { id: 'script', labelKey: 'hardware.rule.script', icon: IconCode },
  { id: 'info', labelKey: 'common.info', icon: null }
];

export const PlugDetailTabs = ({ activeTab, onChange }: PlugDetailTabsProps) => {
  const { t } = useTranslation();

  return (
    <nav
      className="plug-detail-tabs lcl-segmented-control"
      aria-label={t('hardware.shelly.actionsLabel')}
    >
      {tabs.map((tab) => {
        const label = t(tab.labelKey);
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            aria-label={label}
            className="plug-detail-tabs__item lcl-segmented-control__item"
            title={label}
            type="button"
            onClick={() => onChange(tab.id)}
          >
            {Icon ? (
              <Icon className="plug-detail-tabs__icon" aria-hidden="true" />
            ) : (
              <span className="plug-detail-tabs__info-icon" aria-hidden="true">
                i
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
