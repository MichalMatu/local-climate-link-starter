import { useEffect, useRef, useState } from 'react';
import { t } from '../../app/i18n.js';
import { useHardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';
import { DiagnosticsSetupPage } from './pages/DiagnosticsSetupPage.js';
import { RuleSetupPage } from './pages/RuleSetupPage.js';
import { SensorSetupPage } from './pages/SensorSetupPage.js';
import { ShellySetupPage } from './pages/ShellySetupPage.js';

const HARDWARE_TABS = [
  { id: 'shelly', label: t('hardware.nav.shelly'), title: t('hardware.nav.shellyTitle') },
  { id: 'sensor', label: t('hardware.nav.sensor'), title: t('hardware.nav.sensorTitle') },
  { id: 'rule', label: t('hardware.nav.rule'), title: t('hardware.nav.ruleTitle') },
  {
    id: 'diagnostics',
    label: t('hardware.nav.diagnostics'),
    title: t('hardware.nav.diagnosticsTitle')
  }
] as const;

type HardwareTabId = (typeof HARDWARE_TABS)[number]['id'];

const isHardwareTabId = (value: string): value is HardwareTabId =>
  HARDWARE_TABS.some((tab) => tab.id === value);

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

export const HardwareSetupScreen = () => {
  const flow = useHardwareSetupFlow();
  const [activeTab, setActiveTab] = useState<HardwareTabId>(currentTabFromHash);
  const cleanupBleDiscoveryRef = useRef<() => void>(() => undefined);
  cleanupBleDiscoveryRef.current = flow.cleanupBleDiscovery;

  useEffect(() => {
    const handleHashChange = () => setActiveTab(currentTabFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const cleanup = () => cleanupBleDiscoveryRef.current();
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
  }, [activeTab]);

  const selectTab = (tabId: HardwareTabId) => {
    setActiveTab(tabId);
    setHashTab(tabId);
  };

  return (
    <main className="demo-shell hardware-shell">
      <nav className="setup-top-nav" aria-label={t('hardware.nav.label')}>
        {HARDWARE_TABS.map((tab) => (
          <button
            key={tab.id}
            className={
              activeTab === tab.id
                ? 'setup-top-nav__item setup-top-nav__item--active'
                : 'setup-top-nav__item'
            }
            type="button"
            aria-current={activeTab === tab.id ? 'page' : undefined}
            title={tab.title}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'shelly' && <ShellySetupPage flow={flow} />}
      {activeTab === 'sensor' && <SensorSetupPage flow={flow} />}
      {activeTab === 'rule' && <RuleSetupPage flow={flow} />}
      {activeTab === 'diagnostics' && <DiagnosticsSetupPage flow={flow} />}
    </main>
  );
};
