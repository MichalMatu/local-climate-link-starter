import type { SetupIntent } from '../flows/setup-intent.js';

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
const SENSOR_ADD_HARDWARE_TABS = [CLIMATE_HARDWARE_TABS[1]] as const;

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

export type HardwareTabId = 'shelly' | 'sensor' | 'rule' | 'schedule';

export const availableTabsForIntent = (
  setupIntent?: SetupIntent,
  fixedShellyId?: string,
  plugAddOnly = false,
  sensorAddOnly = false
) => {
  if (plugAddOnly) return PLUG_ADD_HARDWARE_TABS;
  if (sensorAddOnly) return SENSOR_ADD_HARDWARE_TABS;
  if (setupIntent === 'time') {
    return fixedShellyId
      ? TIME_HARDWARE_TABS.filter((tab) => tab.id === 'schedule')
      : TIME_HARDWARE_TABS;
  }
  return fixedShellyId
    ? CLIMATE_HARDWARE_TABS.filter((tab) => tab.id === 'rule')
    : CLIMATE_HARDWARE_TABS;
};

export const currentTabFromHash = (
  availableTabs: readonly { id: string }[]
): HardwareTabId => {
  if (typeof window === 'undefined') {
    return (availableTabs[0]?.id as HardwareTabId | undefined) ?? 'shelly';
  }

  const hashValue = window.location.hash.replace(/^#/, '');
  return availableTabs.some((tab) => tab.id === hashValue)
    ? (hashValue as HardwareTabId)
    : ((availableTabs[0]?.id as HardwareTabId | undefined) ?? 'shelly');
};

export const setHashTab = (tabId: HardwareTabId): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.hash = tabId;
  window.history.replaceState(null, '', url);
};
