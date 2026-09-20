import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import { AppPageBack } from '../../components/AppPageBack.js';
import { useHardwareSetupFlow } from '../../flows/hardware-setup/useHardwareSetupFlow.js';
import {
  defaultRulePresetForSetupIntent,
  rulePresetsForSetupIntent,
  type SetupIntent
} from '../../flows/setup-intent.js';
import {
  availableTabsForIntent,
  currentTabFromHash,
  setHashTab,
  type HardwareTabId
} from '../../routes/hardwareSetupTabNavigation.js';
import { RuleSetupPage } from './pages/RuleSetupPage.js';
import { SensorSetupPage } from './pages/SensorSetupPage.js';
import { ShellySetupPage } from './pages/ShellySetupPage.js';
import { TimeScheduleSetupPage } from './pages/TimeScheduleSetupPage.js';

type LocalShellyPage =
  | { kind: 'settings'; deviceId: string }
  | { kind: 'ble'; deviceId: string; returnTo: 'shelly' | 'settings' }
  | null;

type HardwareSetupScreenProps = {
  setupIntent?: SetupIntent;
  onBackToIntent?: () => void;
  onSetupComplete?: () => void;
  onOpenPlugAdd?: () => void;
  onOpenSensorAdd?: (mode: 'manual' | 'phone-scan') => void;
  fixedShellyId?: string;
  editInstallationId?: string;
  plugAddOnly?: boolean;
  sensorAddOnly?: boolean;
  sensorAddMode?: 'manual' | 'phone-scan';
};

export const HardwareSetupScreen = ({
  setupIntent,
  onBackToIntent,
  onSetupComplete,
  onOpenPlugAdd,
  onOpenSensorAdd,
  fixedShellyId,
  editInstallationId,
  plugAddOnly = false,
  sensorAddOnly = false,
  sensorAddMode = 'phone-scan'
}: HardwareSetupScreenProps = {}) => {
  const { t } = useTranslation();
  const flow = useHardwareSetupFlow(editInstallationId);
  const { rulePreset, setRulePreset, selectedShellyId, selectShellyDevice } = flow;
  const availableTabs = useMemo(
    () => availableTabsForIntent(setupIntent, fixedShellyId, plugAddOnly, sensorAddOnly),
    [fixedShellyId, plugAddOnly, sensorAddOnly, setupIntent]
  );
  const [activeTab, setActiveTab] = useState<HardwareTabId>(() =>
    currentTabFromHash(availableTabs)
  );
  const [localAddPage, setLocalAddPage] = useState<'plug' | 'sensor' | null>(null);
  const [localShellyPage, setLocalShellyPage] = useState<LocalShellyPage>(null);
  const [localSensorAddMode, setLocalSensorAddMode] = useState<'manual' | 'phone-scan'>(
    'manual'
  );
  const selectableRulePresets = useMemo(
    () => rulePresetsForSetupIntent(setupIntent),
    [setupIntent]
  );
  const cleanupBleDiscoveryRef = useRef<() => void>(() => undefined);
  const stopSavedSensorLiveScanRef = useRef<() => void>(() => undefined);
  const stopPhoneBleScanRef = useRef<() => void>(() => undefined);
  const stopShellyScanRef = useRef<() => void>(() => undefined);
  cleanupBleDiscoveryRef.current = flow.cleanupBleDiscovery;
  stopSavedSensorLiveScanRef.current = flow.stopSavedSensorLiveScan;
  stopPhoneBleScanRef.current = flow.stopPhoneBleScan;
  stopShellyScanRef.current = flow.stopShellyScan;

  useEffect(() => {
    if (!fixedShellyId || selectedShellyId === fixedShellyId) return;
    selectShellyDevice(fixedShellyId);
  }, [fixedShellyId, selectShellyDevice, selectedShellyId]);

  useEffect(() => {
    if (!setupIntent) return;
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
      stopPhoneBleScanRef.current();
      stopShellyScanRef.current();
    };
    window.addEventListener('pagehide', cleanup);
    return () => {
      cleanup();
      window.removeEventListener('pagehide', cleanup);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'shelly') cleanupBleDiscoveryRef.current();
    if (activeTab !== 'sensor' && activeTab !== 'rule') {
      stopSavedSensorLiveScanRef.current();
    }
  }, [activeTab]);

  const selectTab = (tabId: HardwareTabId) => {
    setActiveTab(tabId);
    setHashTab(tabId);
  };

  const openPlugAdd = onOpenPlugAdd ?? (() => setLocalAddPage('plug'));
  const openSensorAdd =
    onOpenSensorAdd ??
    ((mode: 'manual' | 'phone-scan') => {
      setLocalSensorAddMode(mode);
      setLocalAddPage('sensor');
    });
  const closeLocalAdd = () => {
    if (localAddPage === 'plug') flow.stopShellyScan();
    if (localAddPage === 'sensor') flow.stopPhoneBleScan();
    setLocalAddPage(null);
  };

  if (localShellyPage !== null) {
    const localShelly = flow.shellyDevices.find(
      (device) => device.id === localShellyPage.deviceId
    );

    if (localShellyPage.kind === 'settings') {
      const closeSettings = () => setLocalShellyPage(null);
      return (
        <main className="demo-shell hardware-shell">
          <AppPageBack label={t('hardware.nav.shelly')} onBack={closeSettings} />
          <ShellySetupPage
            flow={flow}
            enableBleDiscovery={setupIntent !== 'time'}
            settingsOnlyDeviceId={localShellyPage.deviceId}
            onSettingsClose={closeSettings}
            onBleScanPageRequest={(device) =>
              setLocalShellyPage({
                kind: 'ble',
                deviceId: device.id,
                returnTo: 'settings'
              })
            }
          />
        </main>
      );
    }

    const closeBleScan = () =>
      setLocalShellyPage(
        localShellyPage.returnTo === 'settings'
          ? { kind: 'settings', deviceId: localShellyPage.deviceId }
          : null
      );
    return (
      <main className="demo-shell hardware-shell">
        <AppPageBack
          label={
            localShellyPage.returnTo === 'settings'
              ? (localShelly?.name ?? t('hardware.nav.shelly'))
              : t('hardware.nav.shelly')
          }
          onBack={closeBleScan}
        />
        <ShellySetupPage
          flow={flow}
          bleScanOnlyDeviceId={localShellyPage.deviceId}
          onBleScanClose={closeBleScan}
        />
      </main>
    );
  }

  if (localAddPage !== null) {
    const isPlug = localAddPage === 'plug';
    return (
      <main className="demo-shell hardware-shell">
        <AppPageBack
          label={isPlug ? t('hardware.nav.shelly') : t('hardware.nav.sensor')}
          onBack={closeLocalAdd}
        />
        {isPlug ? (
          <ShellySetupPage
            flow={flow}
            addOnly
            enableBleDiscovery={setupIntent !== 'time'}
          />
        ) : (
          <SensorSetupPage flow={flow} addOnly primaryAddAction={localSensorAddMode} />
        )}
      </main>
    );
  }

  return (
    <main className="demo-shell hardware-shell">
      {setupIntent && onBackToIntent && !plugAddOnly && !sensorAddOnly && (
        <AppPageBack
          context={t(`intent.${setupIntent}.context`)}
          label={editInstallationId ? t('detail.automation') : t('intent.back')}
          onBack={onBackToIntent}
        />
      )}

      {!plugAddOnly && !sensorAddOnly && availableTabs.length > 1 && (
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
          onAddRequest={openPlugAdd}
          {...(!plugAddOnly && !sensorAddOnly
            ? {
                onSettingsPageRequest: (device) =>
                  setLocalShellyPage({ kind: 'settings', deviceId: device.id }),
                onBleScanPageRequest: (device) =>
                  setLocalShellyPage({
                    kind: 'ble',
                    deviceId: device.id,
                    returnTo: 'shelly'
                  })
              }
            : {})}
        />
      )}
      {setupIntent !== 'time' && activeTab === 'sensor' && (
        <SensorSetupPage
          flow={flow}
          addOnly={sensorAddOnly}
          onAddRequest={openSensorAdd}
          primaryAddAction={sensorAddOnly ? sensorAddMode : 'manual'}
        />
      )}
      {setupIntent !== 'time' && activeTab === 'rule' && (
        <RuleSetupPage
          flow={flow}
          selectablePresets={selectableRulePresets}
          showShellySelector={!fixedShellyId}
          {...(editInstallationId && onSetupComplete
            ? { onEditSaved: onSetupComplete }
            : {})}
        />
      )}
      {setupIntent === 'time' && activeTab === 'schedule' && (
        <TimeScheduleSetupPage
          flow={flow}
          {...(onSetupComplete ? { onInstalled: onSetupComplete } : {})}
        />
      )}
    </main>
  );
};
