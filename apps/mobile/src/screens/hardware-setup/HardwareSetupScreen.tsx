import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import {
  AppBottomNavigation,
  type AppNavigationKind
} from '../../components/AppBottomNavigation.js';
import { useHardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';
import {
  defaultRulePresetForSetupIntent,
  rulePresetsForSetupIntent,
  type SetupIntent
} from '../../flows/setup-intent.js';
import { RuleSetupPage } from './pages/RuleSetupPage.js';
import { SensorSetupPage } from './pages/SensorSetupPage.js';
import { ShellySetupPage } from './pages/ShellySetupPage.js';
import { TimeScheduleSetupPage } from './pages/TimeScheduleSetupPage.js';

const CLIMATE_HARDWARE_TABS = [
  {
    id: 'shelly',
    labelKey: 'hardware.nav.shelly',
    titleKey: 'hardware.nav.shellyTitle'
  },
  {
    id: 'sensor',
    labelKey: 'hardware.nav.sensor',
    titleKey: 'hardware.nav.sensorTitle'
  },
  {
    id: 'rule',
    labelKey: 'hardware.nav.rule',
    titleKey: 'hardware.nav.ruleTitle'
  }
] as const;

const PLUG_ADD_HARDWARE_TABS = [CLIMATE_HARDWARE_TABS[0]] as const;

const TIME_HARDWARE_TABS = [
  {
    id: 'shelly',
    labelKey: 'hardware.nav.shelly',
    titleKey: 'hardware.nav.shellyTitle'
  },
  {
    id: 'schedule',
    labelKey: 'time.nav.schedule',
    titleKey: 'time.nav.scheduleTitle'
  }
] as const;

type PrimaryHardwareTabId = 'shelly' | 'sensor' | 'rule' | 'schedule';
type HardwareTabId = PrimaryHardwareTabId;

const availableTabsForIntent = (
  setupIntent?: SetupIntent,
  fixedShellyId?: string,
  plugAddOnly = false
) => {
  if (plugAddOnly) return PLUG_ADD_HARDWARE_TABS;
  if (setupIntent === 'time') {
    return fixedShellyId
      ? TIME_HARDWARE_TABS.filter((tab) => tab.id === 'schedule')
      : TIME_HARDWARE_TABS;
  }
  return fixedShellyId
    ? CLIMATE_HARDWARE_TABS.filter((tab) => tab.id === 'rule')
    : CLIMATE_HARDWARE_TABS;
};

const currentTabFromHash = (availableTabs: readonly { id: string }[]): HardwareTabId => {
  if (typeof window === 'undefined') {
    return 'shelly';
  }

  const hashValue = window.location.hash.replace(/^#/, '');
  return availableTabs.some((tab) => tab.id === hashValue)
    ? (hashValue as PrimaryHardwareTabId)
    : ((availableTabs[0]?.id as PrimaryHardwareTabId | undefined) ?? 'shelly');
};

const setHashTab = (tabId: HardwareTabId) => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.hash = tabId;
  window.history.replaceState(null, '', url);
};

type HardwareSetupScreenProps = {
  setupIntent?: SetupIntent;
  navigationKind?: AppNavigationKind;
  onBackToIntent?: () => void;
  onNavigateDashboard?: (kind: AppNavigationKind) => void;
  onOpenSettings?: () => void;
  onSetupComplete?: () => void;
  fixedShellyId?: string;
  plugAddOnly?: boolean;
  onPlugAddComplete?: () => void;
  onPlugAddCancel?: () => void;
};

export const HardwareSetupScreen = ({
  setupIntent,
  navigationKind,
  onBackToIntent,
  onNavigateDashboard,
  onOpenSettings,
  onSetupComplete,
  fixedShellyId,
  plugAddOnly = false,
  onPlugAddComplete,
  onPlugAddCancel
}: HardwareSetupScreenProps = {}) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow();
  const { rulePreset, setRulePreset, selectedShellyId, selectShellyDevice } = flow;
  const availableTabs = useMemo(
    () => availableTabsForIntent(setupIntent, fixedShellyId, plugAddOnly),
    [fixedShellyId, plugAddOnly, setupIntent]
  );
  const activeNavigationKind =
    navigationKind ?? (setupIntent === 'time' ? 'time' : 'climate');
  const [activeTab, setActiveTab] = useState<HardwareTabId>(() =>
    currentTabFromHash(availableTabs)
  );
  const selectableRulePresets = useMemo(
    () => rulePresetsForSetupIntent(setupIntent),
    [setupIntent]
  );
  const cleanupBleDiscoveryRef = useRef<() => void>(() => undefined);
  const stopSavedSensorLiveScanRef = useRef<() => void>(() => undefined);
  cleanupBleDiscoveryRef.current = flow.cleanupBleDiscovery;
  stopSavedSensorLiveScanRef.current = flow.stopSavedSensorLiveScan;

  useEffect(() => {
    if (!fixedShellyId || selectedShellyId === fixedShellyId) return;
    selectShellyDevice(fixedShellyId);
  }, [fixedShellyId, selectShellyDevice, selectedShellyId]);

  useEffect(() => {
    if (!setupIntent) {
      return;
    }

    const defaultPreset = defaultRulePresetForSetupIntent(setupIntent);
    if (defaultPreset && !selectableRulePresets.includes(rulePreset)) {
      setRulePreset(defaultPreset);
    }
  }, [rulePreset, selectableRulePresets, setRulePreset, setupIntent]);

  useEffect(() => {
    const handleHashChange = () => setActiveTab(currentTabFromHash(availableTabs));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [availableTabs]);

  useEffect(() => {
    const cleanup = () => {
      cleanupBleDiscoveryRef.current();
      stopSavedSensorLiveScanRef.current();
    };
    window.addEventListener('pagehide', cleanup);
    return () => {
      cleanup();
      window.removeEventListener('pagehide', cleanup);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'shelly') {
      cleanupBleDiscoveryRef.current();
    }
    if (activeTab !== 'sensor') {
      stopSavedSensorLiveScanRef.current();
    }
  }, [activeTab]);

  const selectTab = (tabId: HardwareTabId) => {
    setActiveTab(tabId);
    setHashTab(tabId);
  };

  return (
    <main className="demo-shell hardware-shell app-bottom-nav-shell">
      {setupIntent && onBackToIntent && (
        <div className="setup-context">
          <button className="setup-context__back" type="button" onClick={onBackToIntent}>
            {t('intent.back')}
          </button>
          <strong>{t(`intent.${setupIntent}.context`)}</strong>
        </div>
      )}

      {!plugAddOnly && availableTabs.length > 1 && (
        <nav className="setup-top-nav" aria-label={t('hardware.nav.label')}>
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              className={
                activeTab === tab.id
                  ? 'setup-top-nav__item setup-top-nav__item--active'
                  : 'setup-top-nav__item'
              }
              type="button"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              title={t(tab.titleKey)}
              onClick={() => selectTab(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </nav>
      )}

      {activeTab === 'shelly' && (
        <ShellySetupPage
          flow={flow}
          enableBleDiscovery={setupIntent !== 'time'}
          addOnly={plugAddOnly}
          {...(onPlugAddComplete ? { onAddComplete: onPlugAddComplete } : {})}
          {...(onPlugAddCancel ? { onAddCancel: onPlugAddCancel } : {})}
        />
      )}
      {setupIntent !== 'time' && activeTab === 'sensor' && (
        <SensorSetupPage flow={flow} />
      )}
      {setupIntent !== 'time' && activeTab === 'rule' && (
        <RuleSetupPage
          flow={flow}
          selectablePresets={selectableRulePresets}
          showShellySelector={!fixedShellyId}
        />
      )}
      {setupIntent === 'time' && activeTab === 'schedule' && (
        <TimeScheduleSetupPage
          flow={flow}
          {...(onSetupComplete ? { onInstalled: onSetupComplete } : {})}
        />
      )}

      {onNavigateDashboard && !plugAddOnly && (
        <AppBottomNavigation
          activeKind={activeNavigationKind}
          onOpenClimate={() => onNavigateDashboard('climate')}
          onOpenTime={() => onNavigateDashboard('time')}
          {...(onOpenSettings ? { onOpenSettings } : {})}
        />
      )}
    </main>
  );
};
