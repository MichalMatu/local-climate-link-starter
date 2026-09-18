from pathlib import Path

ROOT = Path('.')

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    if content.count(old) != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {content.count(old)}')
    write(path, content.replace(old, new, 1))

write(
    'apps/mobile/src/flows/hardware-setup/useSavedSensorLiveScanLifecycle.ts',
    '''import { useEffect } from 'react';
import type { HardwareSetupFlow } from './useHardwareSetupFlow.js';

type SavedSensorLiveScanFlow = Pick<
  HardwareSetupFlow,
  | 'restartSavedSensorLiveScan'
  | 'savedSensorLiveScanState'
  | 'startSavedSensorLiveScan'
  | 'stopSavedSensorLiveScan'
>;

const SAVED_SENSOR_LIVE_SCAN_RETRY_MS = 1000;

type SavedSensorLiveScanLifecycleOptions = {
  flow: SavedSensorLiveScanFlow;
  enabled: boolean;
};

export const useSavedSensorLiveScanLifecycle = ({
  flow,
  enabled
}: SavedSensorLiveScanLifecycleOptions) => {
  useEffect(() => {
    if (!enabled) {
      flow.stopSavedSensorLiveScan();
      return;
    }

    flow.startSavedSensorLiveScan();
    return () => flow.stopSavedSensorLiveScan();
  }, [enabled, flow.startSavedSensorLiveScan, flow.stopSavedSensorLiveScan]);

  useEffect(() => {
    if (enabled && !flow.savedSensorLiveScanState.running) {
      const retryTimer = setTimeout(() => {
        flow.startSavedSensorLiveScan();
      }, SAVED_SENSOR_LIVE_SCAN_RETRY_MS);

      return () => clearTimeout(retryTimer);
    }

    return undefined;
  }, [enabled, flow.savedSensorLiveScanState.running, flow.startSavedSensorLiveScan]);

  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    const clearResumeTimer = () => {
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const scheduleResume = () => {
      if (!enabled) {
        return;
      }

      clearResumeTimer();
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        void flow.restartSavedSensorLiveScan();
      }, 250);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearResumeTimer();
        flow.stopSavedSensorLiveScan();
        return;
      }

      scheduleResume();
    };

    const handleFocus = () => {
      if (document.visibilityState !== 'hidden') {
        scheduleResume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearResumeTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, flow.restartSavedSensorLiveScan, flow.stopSavedSensorLiveScan]);
};
'''
)

write(
    'apps/mobile/src/flows/hardware-setup/useRuleSensorReadings.ts',
    '''import { calculateVpdKpa } from '@lcl/automation-core';
import { useQueries } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from '../installations/model.js';
import { fetchInstalledAutomationDiagnostics } from '../installations/runtimeDiagnostics.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { installedAutomationDiagnosticsQueryKey } from '../installations/useInstalledAutomationRuntime.js';
import type { SensorReadingSample } from './sensorReadingsStore.js';
import type { SensorDraftDevice } from './setupDraftStore.js';

const RULE_SENSOR_RUNTIME_REFRESH_MS = 5_000;

const normalizeSensorId = (sensorId: string): string => sensorId.trim().toUpperCase();
const normalizeBaseUrl = (baseUrl: string | null | undefined): string =>
  baseUrl?.trim().replace(/\/$/, '').toLowerCase() ?? '';

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export type RuleSensorLiveReading = {
  source: 'phone' | 'shelly-runtime';
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  vpdKpa?: number | undefined;
  seenAtMs: number;
  stale: boolean;
  shellyName?: string | undefined;
  shellyBaseUrl?: string | undefined;
};

type RuleSensorReadingsOptions = {
  sensorDevices: readonly SensorDraftDevice[];
  samplesBySensorId: Record<string, SensorReadingSample[]>;
  preferredShellyBaseUrl?: string | null | undefined;
};

const isClimateInstallation = (
  installation: ReturnType<
    typeof useInstalledAutomationStore.getState
  >['installations'][number]
): installation is ClimateInstalledAutomation => installation.kind === 'climate';

const phoneReading = (sample: SensorReadingSample | undefined): RuleSensorLiveReading | null => {
  if (!sample || sample.source !== 'phone-scan') {
    return null;
  }

  const temperatureC = finiteNumber(sample.temperatureC);
  const humidityPct = finiteNumber(sample.humidityPct);
  return {
    source: 'phone',
    temperatureC,
    humidityPct,
    vpdKpa: finiteNumber(calculateVpdKpa(temperatureC, humidityPct)),
    seenAtMs: sample.seenAtMs,
    stale: false
  };
};

const shouldReplaceRuntimeReading = ({
  current,
  candidate,
  preferredShellyBaseUrl
}: {
  current: RuleSensorLiveReading | undefined;
  candidate: RuleSensorLiveReading;
  preferredShellyBaseUrl: string;
}): boolean => {
  if (!current || current.source === 'phone') {
    return true;
  }

  const currentPreferred =
    preferredShellyBaseUrl.length > 0 &&
    normalizeBaseUrl(current.shellyBaseUrl) === preferredShellyBaseUrl;
  const candidatePreferred =
    preferredShellyBaseUrl.length > 0 &&
    normalizeBaseUrl(candidate.shellyBaseUrl) === preferredShellyBaseUrl;

  if (currentPreferred !== candidatePreferred) {
    return candidatePreferred;
  }
  if (current.stale !== candidate.stale) {
    return current.stale && !candidate.stale;
  }
  return candidate.seenAtMs > current.seenAtMs;
};

export const useRuleSensorReadings = ({
  sensorDevices,
  samplesBySensorId,
  preferredShellyBaseUrl
}: RuleSensorReadingsOptions): Record<string, RuleSensorLiveReading> => {
  const installations = useInstalledAutomationStore((state) => state.installations);
  const sensorIds = new Set(
    sensorDevices.map((device) => normalizeSensorId(device.runtimeAddress))
  );
  const runtimeInstallations = installations.filter(
    (installation): installation is ClimateInstalledAutomation =>
      isClimateInstallation(installation) &&
      sensorIds.has(normalizeSensorId(installation.config.sensor.runtimeAddress))
  );

  const runtimeQueries = useQueries({
    queries: runtimeInstallations.map((installation) => ({
      queryKey: installedAutomationDiagnosticsQueryKey(installation),
      queryFn: () => fetchInstalledAutomationDiagnostics(installation),
      retry: false,
      refetchInterval: RULE_SENSOR_RUNTIME_REFRESH_MS,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }))
  });

  const readings: Record<string, RuleSensorLiveReading> = {};

  sensorDevices.forEach((device) => {
    const sensorId = normalizeSensorId(device.runtimeAddress);
    const sample = samplesBySensorId[sensorId]?.at(-1);
    const reading = phoneReading(sample);
    if (reading) {
      readings[sensorId] = reading;
    }
  });

  const preferredBaseUrl = normalizeBaseUrl(preferredShellyBaseUrl);
  runtimeInstallations.forEach((installation, index) => {
    const query = runtimeQueries[index];
    const snapshot = query?.data;
    if (!snapshot) {
      return;
    }

    const diagnostics = snapshot.diagnostics;
    const temperatureC = finiteNumber(diagnostics.lastTemp);
    const humidityPct = finiteNumber(diagnostics.lastHumidity);
    const lastSeenUptimeMs = finiteNumber(diagnostics.lastSeenUptimeMs);
    if (
      temperatureC === undefined &&
      humidityPct === undefined &&
      lastSeenUptimeMs === undefined
    ) {
      return;
    }

    const currentUptimeMs =
      typeof snapshot.time.uptimeSec === 'number' && Number.isFinite(snapshot.time.uptimeSec)
        ? snapshot.time.uptimeSec * 1000
        : undefined;
    const ageMs =
      currentUptimeMs !== undefined && lastSeenUptimeMs !== undefined
        ? Math.max(0, currentUptimeMs - lastSeenUptimeMs)
        : 0;
    const fetchedAtMs = query.dataUpdatedAt > 0 ? query.dataUpdatedAt : Date.now();
    const sensorId = normalizeSensorId(installation.config.sensor.runtimeAddress);
    const explicitVpdKpa = finiteNumber(diagnostics.lastVpd);
    const candidate: RuleSensorLiveReading = {
      source: 'shelly-runtime',
      temperatureC,
      humidityPct,
      vpdKpa:
        explicitVpdKpa ?? finiteNumber(calculateVpdKpa(temperatureC, humidityPct)),
      seenAtMs: Math.max(0, fetchedAtMs - ageMs),
      stale:
        diagnostics.dataState === 'st' ||
        (lastSeenUptimeMs !== undefined &&
          currentUptimeMs !== undefined &&
          ageMs > snapshot.rule.staleTimeoutSec * 1000),
      shellyName: installation.shelly.name,
      shellyBaseUrl: installation.shelly.baseUrl
    };

    if (
      shouldReplaceRuntimeReading({
        current: readings[sensorId],
        candidate,
        preferredShellyBaseUrl: preferredBaseUrl
      })
    ) {
      readings[sensorId] = candidate;
    }
  });

  return readings;
};
'''
)

replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts',
    "import type { SensorSetupFlow } from '../pageContracts.js';\n",
    "import type { SensorSetupFlow } from '../pageContracts.js';\nimport { useSavedSensorLiveScanLifecycle } from '../../../flows/hardware-setup/useSavedSensorLiveScanLifecycle.js';\n"
)
replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts',
    "\nconst SAVED_SENSOR_LIVE_SCAN_RETRY_MS = 1000;\n",
    "\n"
)
old_scan_effects = '''\n  useEffect(() => {\n    if (!shouldRunSavedSensorLiveScan) {\n      flow.stopSavedSensorLiveScan();\n      return;\n    }\n\n    flow.startSavedSensorLiveScan();\n    return () => flow.stopSavedSensorLiveScan();\n  }, [\n    flow.startSavedSensorLiveScan,\n    flow.stopSavedSensorLiveScan,\n    shouldRunSavedSensorLiveScan\n  ]);\n\n  useEffect(() => {\n    if (shouldRunSavedSensorLiveScan && !flow.savedSensorLiveScanState.running) {\n      const retryTimer = setTimeout(() => {\n        flow.startSavedSensorLiveScan();\n      }, SAVED_SENSOR_LIVE_SCAN_RETRY_MS);\n\n      return () => clearTimeout(retryTimer);\n    }\n\n    return undefined;\n  }, [\n    flow.savedSensorLiveScanState.running,\n    flow.startSavedSensorLiveScan,\n    shouldRunSavedSensorLiveScan\n  ]);\n\n  useEffect(() => {\n    let resumeTimer: ReturnType<typeof setTimeout> | null = null;\n\n    const clearResumeTimer = () => {\n      if (resumeTimer !== null) {\n        clearTimeout(resumeTimer);\n        resumeTimer = null;\n      }\n    };\n\n    const scheduleResume = () => {\n      if (!shouldRunSavedSensorLiveScan) {\n        return;\n      }\n\n      clearResumeTimer();\n      resumeTimer = setTimeout(() => {\n        resumeTimer = null;\n        void flow.restartSavedSensorLiveScan();\n      }, 250);\n    };\n\n    const handleVisibilityChange = () => {\n      if (document.visibilityState === 'hidden') {\n        clearResumeTimer();\n        flow.stopSavedSensorLiveScan();\n        return;\n      }\n\n      scheduleResume();\n    };\n\n    const handleFocus = () => {\n      if (document.visibilityState !== 'hidden') {\n        scheduleResume();\n      }\n    };\n\n    document.addEventListener('visibilitychange', handleVisibilityChange);\n    window.addEventListener('focus', handleFocus);\n\n    return () => {\n      clearResumeTimer();\n      document.removeEventListener('visibilitychange', handleVisibilityChange);\n      window.removeEventListener('focus', handleFocus);\n    };\n  }, [\n    flow.restartSavedSensorLiveScan,\n    flow.stopSavedSensorLiveScan,\n    shouldRunSavedSensorLiveScan\n  ]);\n'''
replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts',
    old_scan_effects,
    "\n  useSavedSensorLiveScanLifecycle({ flow, enabled: shouldRunSavedSensorLiveScan });\n"
)

replace_once(
    'apps/mobile/src/screens/hardware-setup/pageContracts.ts',
    "  | 'safeRelayTestMutation'\n  | 'selectSensorDevice'\n",
    "  | 'restartSavedSensorLiveScan'\n  | 'safeRelayTestMutation'\n  | 'savedSensorLiveScanState'\n  | 'selectSensorDevice'\n"
)
replace_once(
    'apps/mobile/src/screens/hardware-setup/pageContracts.ts',
    "  | 'sensorDevices'\n  | 'setMaxOnHoursInput'\n",
    "  | 'sensorDevices'\n  | 'sensorSamplesById'\n  | 'setMaxOnHoursInput'\n"
)
replace_once(
    'apps/mobile/src/screens/hardware-setup/pageContracts.ts',
    "  | 'shellyDevices'\n  | 'staleTimeoutMinInput'\n",
    "  | 'shellyDevices'\n  | 'startSavedSensorLiveScan'\n  | 'staleTimeoutMinInput'\n  | 'stopSavedSensorLiveScan'\n"
)

replace_once(
    'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx',
    "    if (activeTab !== 'sensor') {\n      stopSavedSensorLiveScanRef.current();\n    }\n",
    "    if (activeTab !== 'sensor' && activeTab !== 'rule') {\n      stopSavedSensorLiveScanRef.current();\n    }\n"
)

replace_once(
    'packages/ui/src/primitives/SelectField.tsx',
    "  type KeyboardEvent as ReactKeyboardEvent\n} from 'react';\n",
    "  type KeyboardEvent as ReactKeyboardEvent,\n  type ReactNode\n} from 'react';\n"
)
replace_once(
    'packages/ui/src/primitives/SelectField.tsx',
    "  label: string;\n  disabled?: boolean;\n",
    "  label: string;\n  meta?: ReactNode;\n  disabled?: boolean;\n"
)
replace_once(
    'packages/ui/src/primitives/SelectField.tsx',
    '''                aria-selected={selected}\n                className={`lcl-select-field__option ${\n                  selected ? 'lcl-select-field__option--selected' : ''\n                }`.trim()}\n''',
    '''                aria-describedby={\n                  option.meta ? `${listboxId}-option-${index}-meta` : undefined\n                }\n                aria-label={option.label}\n                aria-selected={selected}\n                className={`lcl-select-field__option ${\n                  selected ? 'lcl-select-field__option--selected' : ''\n                }`.trim()}\n'''
)
replace_once(
    'packages/ui/src/primitives/SelectField.tsx',
    '''              >\n                <span>{option.label}</span>\n                <span className="lcl-select-field__check" aria-hidden="true">\n                  {selected ? '✓' : ''}\n                </span>\n              </button>\n''',
    '''              >\n                <span className="lcl-select-field__option-content">\n                  <span className="lcl-select-field__option-label">{option.label}</span>\n                  {option.meta && (\n                    <span\n                      className="lcl-select-field__option-meta"\n                      id={`${listboxId}-option-${index}-meta`}\n                    >\n                      {option.meta}\n                    </span>\n                  )}\n                </span>\n                <span className="lcl-select-field__check" aria-hidden="true">\n                  {selected ? '✓' : ''}\n                </span>\n              </button>\n'''
)

replace_once(
    'packages/ui/src/primitives/SelectField.css',
    '''  min-height: var(--lcl-size-control-min-height);\n  padding: 0 var(--lcl-spacing-md);\n  text-align: left;\n  width: 100%;\n}\n\n.lcl-select-field__option:hover,\n''',
    '''  min-height: var(--lcl-size-control-min-height);\n  padding: var(--lcl-spacing-xs) var(--lcl-spacing-md);\n  text-align: left;\n  width: 100%;\n}\n\n.lcl-select-field__option-content {\n  align-items: baseline;\n  display: flex;\n  flex: 1 1 auto;\n  flex-wrap: wrap;\n  gap: var(--lcl-spacing-xs) var(--lcl-spacing-md);\n  justify-content: space-between;\n  min-width: 0;\n}\n\n.lcl-select-field__option-label {\n  flex: 1 1 8rem;\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n\n.lcl-select-field__option-meta {\n  flex: 0 0 auto;\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.lcl-select-field__option:hover,\n'''
)

replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
    "import type { RuleSetupFlow } from '../pageContracts.js';\n",
    "import type { RuleSetupFlow } from '../pageContracts.js';\nimport { IconDeviceMobile, IconPlug } from '@tabler/icons-react';\n"
)
replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
    "import { canInstallScript, mutationError, type HardwarePageProps } from '../helpers.js';\n",
    "import { canInstallScript, mutationError, type HardwarePageProps } from '../helpers.js';\nimport { useRuleSensorReadings } from '../../../flows/hardware-setup/useRuleSensorReadings.js';\nimport { useSavedSensorLiveScanLifecycle } from '../../../flows/hardware-setup/useSavedSensorLiveScanLifecycle.js';\n"
)
replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
    "type RuleControlCopy = {\n",
    '''const formatCompactSensorMetric = (\n  value: number | undefined,\n  unit: string,\n  fractionDigits: number\n): string =>\n  typeof value === 'number' && Number.isFinite(value)\n    ? `${value.toFixed(fractionDigits)}${unit}`\n    : `—${unit}`;\n\nconst formatSensorLiveSummary = (reading: {\n  temperatureC?: number | undefined;\n  humidityPct?: number | undefined;\n  vpdKpa?: number | undefined;\n} | undefined): string =>\n  `${formatCompactSensorMetric(reading?.temperatureC, '°C', 1)} · ${formatCompactSensorMetric(\n    reading?.humidityPct,\n    '%',\n    1\n  )} · ${formatCompactSensorMetric(reading?.vpdKpa, 'kPa', 2)}`;\n\ntype RuleControlCopy = {\n'''
)
replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
    "  const isScriptActionBusy = flow.loadAutomationScriptMutation.isPending;\n",
    '''  const isScriptActionBusy = flow.loadAutomationScriptMutation.isPending;\n  useSavedSensorLiveScanLifecycle({\n    flow,\n    enabled: flow.sensorDevices.length > 0\n  });\n  const sensorLiveReadings = useRuleSensorReadings({\n    sensorDevices: flow.sensorDevices,\n    samplesBySensorId: flow.sensorSamplesById,\n    preferredShellyBaseUrl: flow.selectedShelly?.baseUrl\n  });\n'''
)
replace_once(
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
    '''          options={flow.sensorDevices.map((device) => ({\n            value: device.id,\n            label: device.name\n          }))}\n''',
    '''          options={flow.sensorDevices.map((device) => {\n            const reading = sensorLiveReadings[device.runtimeAddress.toUpperCase()];\n            const sourceTitle =\n              reading?.source === 'shelly-runtime'\n                ? `${t('hardware.rule.selectedShelly')}: ${reading.shellyName ?? ''}`\n                : reading?.source === 'phone'\n                  ? t('hardware.sensor.scanPhoneTitle')\n                  : undefined;\n\n            return {\n              value: device.id,\n              label: device.name,\n              meta: (\n                <span\n                  className={`rule-sensor-option-live${\n                    reading?.stale ? ' rule-sensor-option-live--stale' : ''\n                  }`}\n                  title={sourceTitle}\n                >\n                  {reading?.source === 'shelly-runtime' ? (\n                    <IconPlug aria-hidden="true" />\n                  ) : reading?.source === 'phone' ? (\n                    <IconDeviceMobile aria-hidden="true" />\n                  ) : null}\n                  <span>{formatSensorLiveSummary(reading)}</span>\n                </span>\n              )\n            };\n          })}\n'''
)

append_css = '''\n\n.rule-sensor-option-live {\n  align-items: center;\n  color: var(--lcl-color-text-muted);\n  display: inline-flex;\n  font-size: var(--lcl-font-size-sm);\n  font-variant-numeric: tabular-nums;\n  gap: var(--lcl-spacing-xs);\n  line-height: var(--lcl-line-height-tight);\n  white-space: nowrap;\n}\n\n.rule-sensor-option-live > svg {\n  flex: 0 0 auto;\n  height: 1rem;\n  width: 1rem;\n}\n\n.rule-sensor-option-live--stale {\n  opacity: var(--lcl-opacity-muted);\n}\n'''
theme_path = 'apps/mobile/src/theme/theme.css'
theme = read(theme_path)
if '.rule-sensor-option-live {' not in theme:
    write(theme_path, theme.rstrip() + append_css + '\n')

print('Applied rule thermometer dropdown live-value UI with grouped responsive metadata')
