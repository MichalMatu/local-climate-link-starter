import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import { useHardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';
import {
  defaultRulePresetForSetupIntent,
  rulePresetsForSetupIntent,
  type SetupIntent
} from '../../flows/setup-intent.js';
import { DiagnosticsSetupPage } from './pages/DiagnosticsSetupPage.js';
import { RuleSetupPage } from './pages/RuleSetupPage.js';
import { SensorSetupPage } from './pages/SensorSetupPage.js';
import { ShellySetupPage } from './pages/ShellySetupPage.js';

const PRIMARY_HARDWARE_TABS = [
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

type PrimaryHardwareTabId = (typeof PRIMARY_HARDWARE_TABS)[number]['id'];
type HardwareTabId = PrimaryHardwareTabId | 'diagnostics';

const isHardwareTabId = (value: string): value is HardwareTabId =>
  value === 'diagnostics' || PRIMARY_HARDWARE_TABS.some((tab) => tab.id === value);

const currentTabFromHash = (): HardwareTabId => {
  if (typeof window === 'undefined') {
    return 'shelly';
  }

  const hashValue = window.location.hash.replace(/^#/, '');
  return isHardwareTabId(hashValue) ? hashValue : 'shelly';
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
  onBackToIntent?: () => void;
};

export const HardwareSetupScreen = ({
  setupIntent,
  onBackToIntent
}: HardwareSetupScreenProps = {}) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow();
  const { rulePreset, setRulePreset } = flow;
  const [activeTab, setActiveTab] = useState<HardwareTabId>(currentTabFromHash);
  const selectableRulePresets = useMemo(
    () => rulePresetsForSetupIntent(setupIntent),
    [setupIntent]
  );
  const cleanupBleDiscoveryRef = useRef<() => void>(() => undefined);
  const stopSavedSensorLiveScanRef = useRef<() => void>(() => undefined);
  cleanupBleDiscoveryRef.current = flow.cleanupBleDiscovery;
  stopSavedSensorLiveScanRef.current = flow.stopSavedSensorLiveScan;

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
    const handleHashChange = () => setActiveTab(currentTabFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
    <main className="demo-shell hardware-shell">
      {setupIntent && onBackToIntent && (
        <div className="setup-context">
          <button className="setup-context__back" type="button" onClick={onBackToIntent}>
            {t('intent.back')}
          </button>
          <strong>{t(`intent.${setupIntent}.context`)}</strong>
        </div>
      )}

      <nav className="setup-top-nav" aria-label={t('hardware.nav.label')}>
        {PRIMARY_HARDWARE_TABS.map((tab) => (
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

      {activeTab === 'shelly' && <ShellySetupPage flow={flow} />}
      {activeTab === 'sensor' && <SensorSetupPage flow={flow} />}
      {activeTab === 'rule' && (
        <RuleSetupPage
          flow={flow}
          selectablePresets={selectableRulePresets}
          onOpenDiagnostics={() => selectTab('diagnostics')}
        />
      )}
      {activeTab === 'diagnostics' && (
        <>
          <div className="developer-context">
            <button
              className="setup-context__back"
              type="button"
              onClick={() => selectTab('rule')}
            >
              {t('hardware.nav.backToRule')}
            </button>
            <div>
              <strong>{t('hardware.nav.developerDiagnostics')}</strong>
              <p>{t('hardware.nav.developerDiagnosticsHint')}</p>
            </div>
          </div>
          <DiagnosticsSetupPage flow={flow} />
        </>
      )}
    </main>
  );
};
