from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if text.count(old) != 1:
        raise SystemExit(f"{path}: expected exactly one match, got {text.count(old)}")
    write(path, text.replace(old, new, 1))


# Keep only the latest merged live reading per sensor. No history buffer or persistence.
write(
    'apps/mobile/src/flows/hardware-setup/sensorReadingsStore.ts',
    '''import type { Measurement } from '@lcl/ble-core';
import { create } from 'zustand';
import type { BleDiscoveryCandidate } from './schemas.js';

export interface SensorReadingSample {
  sensorId: string;
  source: Measurement['source'];
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  batteryPct?: number | undefined;
  voltageV?: number | undefined;
  rssi?: number | undefined;
  seenAtMs: number;
}

type SensorReadingsState = {
  samplesBySensorId: Record<string, SensorReadingSample[]>;
  appendSensorReading(sample: SensorReadingSample): void;
  clearSensorReadings(sensorId: string): void;
};

const normalizeSensorId = (sensorId: string): string => sensorId.toUpperCase();

const mergeLatestReading = (
  previous: SensorReadingSample | undefined,
  incoming: SensorReadingSample
): SensorReadingSample => ({
  sensorId: normalizeSensorId(incoming.sensorId),
  source:
    previous && previous.seenAtMs > incoming.seenAtMs ? previous.source : incoming.source,
  temperatureC: incoming.temperatureC ?? previous?.temperatureC,
  humidityPct: incoming.humidityPct ?? previous?.humidityPct,
  batteryPct: incoming.batteryPct ?? previous?.batteryPct,
  voltageV: incoming.voltageV ?? previous?.voltageV,
  rssi: incoming.rssi ?? previous?.rssi,
  seenAtMs: Math.max(previous?.seenAtMs ?? 0, incoming.seenAtMs)
});

export const sensorReadingFromCandidate = (
  candidate: BleDiscoveryCandidate,
  source: Measurement['source']
): SensorReadingSample => ({
  sensorId: normalizeSensorId(candidate.runtimeAddress),
  source,
  temperatureC: candidate.temperatureC ?? undefined,
  humidityPct: candidate.humidityPct ?? undefined,
  batteryPct: candidate.batteryPct ?? undefined,
  voltageV: candidate.voltageV ?? undefined,
  rssi: candidate.rssi ?? undefined,
  seenAtMs: candidate.seenAt ?? Date.now()
});

export const useHardwareSetupReadingsStore = create<SensorReadingsState>((set) => ({
  samplesBySensorId: {},
  appendSensorReading: (sample) =>
    set((state) => {
      const sensorId = normalizeSensorId(sample.sensorId);
      const previous = state.samplesBySensorId[sensorId]?.[0];
      return {
        samplesBySensorId: {
          ...state.samplesBySensorId,
          [sensorId]: [mergeLatestReading(previous, { ...sample, sensorId })]
        }
      };
    }),
  clearSensorReadings: (sensorId) =>
    set((state) => {
      const remaining = { ...state.samplesBySensorId };
      delete remaining[normalizeSensorId(sensorId)];
      return { samplesBySensorId: remaining };
    })
}));

export const resetHardwareSetupReadingsStore = (): void => {
  useHardwareSetupReadingsStore.setState({ samplesBySensorId: {} });
};
'''
)

write(
    'apps/mobile/src/flows/hardware-setup/sensorReadingsStore.test.ts',
    '''import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetHardwareSetupReadingsStore,
  useHardwareSetupReadingsStore
} from './sensorReadingsStore.js';

describe('hardware setup sensor readings store', () => {
  beforeEach(() => resetHardwareSetupReadingsStore());

  it('keeps only the latest live state per sensor', () => {
    const store = useHardwareSetupReadingsStore.getState();
    store.appendSensorReading({
      sensorId: 'aa:bb:cc:dd:ee:ff',
      source: 'phone-scan',
      temperatureC: 21.5,
      humidityPct: 44,
      seenAtMs: 1000
    });
    useHardwareSetupReadingsStore.getState().appendSensorReading({
      sensorId: 'aa:bb:cc:dd:ee:ff',
      source: 'phone-scan',
      temperatureC: 21.7,
      rssi: -52,
      seenAtMs: 2000
    });

    expect(
      useHardwareSetupReadingsStore.getState().samplesBySensorId['AA:BB:CC:DD:EE:FF']
    ).toEqual([
      {
        sensorId: 'AA:BB:CC:DD:EE:FF',
        source: 'phone-scan',
        temperatureC: 21.7,
        humidityPct: 44,
        rssi: -52,
        seenAtMs: 2000
      }
    ]);
  });

  it('clears live state for a removed sensor', () => {
    useHardwareSetupReadingsStore.getState().appendSensorReading({
      sensorId: 'aa:bb:cc:dd:ee:ff',
      source: 'phone-scan',
      temperatureC: 21.5,
      seenAtMs: 1000
    });
    useHardwareSetupReadingsStore.getState().clearSensorReadings('AA:BB:CC:DD:EE:FF');
    expect(useHardwareSetupReadingsStore.getState().samplesBySensorId).toEqual({});
  });
});
'''
)

# Flow: keep live readings and PVVX time setup, remove chart-oriented memo history path.
flow_path = 'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts'
flow = read(flow_path)
flow = flow.replace('  readPvvxMemoHistory,\n', '')
flow = flow.replace('  sensorReadingFromCandidate,\n  sensorReadingFromMeasurement,\n  useHardwareSetupReadingsStore\n', '  sensorReadingFromCandidate,\n  useHardwareSetupReadingsStore\n')
flow = re.sub(r"\ntype PvvxHistoryMutationResult = \{\n  device: SensorDraftDevice;\n  sampleCount: number;\n\};\n", '\n', flow, count=1)
flow = re.sub(
    r"\n  const appendSensorReadings = useHardwareSetupReadingsStore\(\n    \(state\) => state\.appendSensorReadings\n  \);",
    '',
    flow,
    count=1
)
flow = re.sub(
    r"\n  const fetchPvvxHistoryMutation = useMutation\(\{.*?\n  \}\);\n\n  const setPvvxTimeMutation",
    '\n\n  const setPvvxTimeMutation',
    flow,
    count=1,
    flags=re.S
)
flow = flow.replace('    fetchPvvxHistoryMutation,\n', '')
if 'readPvvxMemoHistory' in flow or 'appendSensorReadings' in flow or 'fetchPvvxHistoryMutation' in flow:
    raise SystemExit('useHardwareSetupFlow.ts: history references remain')
write(flow_path, flow)

# Sensor UI: current metrics only; no embedded charts or history-download action.
sensor_path = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
sensor = read(sensor_path)
sensor = sensor.replace('  Sparkline,\n', '')
sensor = re.sub(
    r"\nconst temperatureChartDomain = \{ minimumRange: 5 \} as const;\nconst humidityChartDomain = \{\n  minimumRange: 20,\n  lowerBound: 0,\n  upperBound: 100\n\} as const;\n",
    '\n',
    sensor,
    count=1
)
sensor = re.sub(
    r"\nconst sampleValues = \(\n  samples: SensorReadingSample\[\],\n  metric: 'temperatureC' \| 'humidityPct'\n\): Array<number \| undefined> => samples\.map\(\(sample\) => sample\[metric\]\);\n",
    '\n',
    sensor,
    count=1
)
sensor = sensor.replace(
    "  const isSensorGattPending =\n    flow.fetchPvvxHistoryMutation.isPending || flow.setPvvxTimeMutation.isPending;",
    "  const isSensorGattPending = flow.setPvvxTimeMutation.isPending;"
)
sensor = re.sub(
    r"\n  useEffect\(\(\) => \{\n    if \(!flow\.fetchPvvxHistoryMutation\.isSuccess\).*?\n  \}, \[flow\.fetchPvvxHistoryMutation, pushToast, t\]\);\n\n  useEffect\(\(\) => \{\n    if \(!flow\.fetchPvvxHistoryMutation\.isError\).*?\n  \}, \[flow\.fetchPvvxHistoryMutation, pushToast, t\]\);\n",
    '\n',
    sensor,
    count=1,
    flags=re.S
)
old_actions = '''            {sensorSettingsDevice.profileId === 'xiaomi_lywsd03mmc_bthome_v2' && (
              <div className="settings-action-stack">
                <button
                  className="secondary-action"
                  type="button"
                  disabled={flow.fetchPvvxHistoryMutation.isPending}
                  title={t('hardware.sensor.pvvxHistoryTitle')}
                  onClick={() =>
                    flow.fetchPvvxHistoryMutation.mutate(sensorSettingsDevice)
                  }
                >
                  {flow.fetchPvvxHistoryMutation.isPending
                    ? t('hardware.sensor.pvvxHistoryLoading')
                    : t('hardware.sensor.pvvxHistory')}
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={flow.setPvvxTimeMutation.isPending}
                  title={t('hardware.sensor.pvvxSetTimeTitle')}
                  onClick={() => flow.setPvvxTimeMutation.mutate(sensorSettingsDevice)}
                >
                  {flow.setPvvxTimeMutation.isPending
                    ? t('hardware.sensor.pvvxTimeSetting')
                    : t('hardware.sensor.pvvxSetTime')}
                </button>
              </div>
            )}'''
new_actions = '''            {sensorSettingsDevice.profileId === 'xiaomi_lywsd03mmc_bthome_v2' && (
              <div className="settings-action-stack">
                <button
                  className="secondary-action"
                  type="button"
                  disabled={flow.setPvvxTimeMutation.isPending}
                  title={t('hardware.sensor.pvvxSetTimeTitle')}
                  onClick={() => flow.setPvvxTimeMutation.mutate(sensorSettingsDevice)}
                >
                  {flow.setPvvxTimeMutation.isPending
                    ? t('hardware.sensor.pvvxTimeSetting')
                    : t('hardware.sensor.pvvxSetTime')}
                </button>
              </div>
            )}'''
if old_actions not in sensor:
    raise SystemExit('SensorSetupPage.tsx: settings history block not found')
sensor = sensor.replace(old_actions, new_actions, 1)
old_cards = '''              <div className="sensor-chart-stack">
                <div
                  className={
                    hasTemperatureData
                      ? 'sensor-data-chart-card'
                      : 'sensor-data-chart-card sensor-data-chart-card--empty'
                  }
                >
                  <strong
                    className={
                      hasTemperatureData
                        ? 'sensor-data-chart-card__value'
                        : 'sensor-data-chart-card__value sensor-data-chart-card__value--empty'
                    }
                  >
                    {formatNullableMetric(
                      temperatureSample?.temperatureC,
                      '°C',
                      1,
                      t('common.missingData')
                    )}
                  </strong>
                  <Sparkline
                    label={t('hardware.sensor.temperatureChartLabel', {
                      name: device.name
                    })}
                    domain={temperatureChartDomain}
                    points={sampleValues(samples, 'temperatureC')}
                  />
                </div>
                <div
                  className={
                    hasHumidityData
                      ? 'sensor-data-chart-card'
                      : 'sensor-data-chart-card sensor-data-chart-card--empty'
                  }
                >
                  <strong
                    className={
                      hasHumidityData
                        ? 'sensor-data-chart-card__value'
                        : 'sensor-data-chart-card__value sensor-data-chart-card__value--empty'
                    }
                  >
                    {formatNullableMetric(
                      humiditySample?.humidityPct,
                      '%',
                      1,
                      t('common.missingData')
                    )}
                  </strong>
                  <Sparkline
                    label={t('hardware.sensor.humidityChartLabel', {
                      name: device.name
                    })}
                    domain={humidityChartDomain}
                    points={sampleValues(samples, 'humidityPct')}
                  />
                </div>
              </div>'''
new_cards = '''              <div className="sensor-metric-grid">
                <div
                  className={
                    hasTemperatureData
                      ? 'sensor-data-metric-card'
                      : 'sensor-data-metric-card sensor-data-metric-card--empty'
                  }
                >
                  <span className="sensor-data-metric-card__label">
                    {t('hardware.metrics.temperature')}
                  </span>
                  <strong
                    className={
                      hasTemperatureData
                        ? 'sensor-data-metric-card__value'
                        : 'sensor-data-metric-card__value sensor-data-metric-card__value--empty'
                    }
                  >
                    {formatNullableMetric(
                      temperatureSample?.temperatureC,
                      '°C',
                      1,
                      t('common.missingData')
                    )}
                  </strong>
                </div>
                <div
                  className={
                    hasHumidityData
                      ? 'sensor-data-metric-card'
                      : 'sensor-data-metric-card sensor-data-metric-card--empty'
                  }
                >
                  <span className="sensor-data-metric-card__label">
                    {t('hardware.metrics.humidity')}
                  </span>
                  <strong
                    className={
                      hasHumidityData
                        ? 'sensor-data-metric-card__value'
                        : 'sensor-data-metric-card__value sensor-data-metric-card__value--empty'
                    }
                  >
                    {formatNullableMetric(
                      humiditySample?.humidityPct,
                      '%',
                      1,
                      t('common.missingData')
                    )}
                  </strong>
                </div>
              </div>'''
if old_cards not in sensor:
    raise SystemExit('SensorSetupPage.tsx: chart card block not found')
sensor = sensor.replace(old_cards, new_cards, 1)
for forbidden in ('Sparkline', 'ChartDomain', 'sampleValues', 'fetchPvvxHistoryMutation'):
    if forbidden in sensor:
        raise SystemExit(f'SensorSetupPage.tsx: forbidden reference remains: {forbidden}')
write(sensor_path, sensor)

# Metric-only CSS.
theme_path = 'apps/mobile/src/theme/theme.css'
theme = read(theme_path)
old_theme = '''.sensor-chart-stack {
  display: grid;
  gap: var(--lcl-spacing-sm);
}

.sensor-data-chart-card {
  align-content: start;
  background: var(--lcl-color-surface-muted);
  border-radius: var(--lcl-radius-md);
  display: grid;
  gap: var(--lcl-spacing-xs);
  padding: var(--lcl-spacing-md);
}

.sensor-data-chart-card--empty {
  align-content: center;
  justify-items: center;
  min-height: calc(var(--lcl-size-compact-control-min-height) + var(--lcl-spacing-2xl));
}

.sensor-data-chart-card__value {
  color: var(--lcl-color-text);
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-sm));
  font-weight: 700;
  line-height: var(--lcl-line-height-tight);
}

.sensor-data-chart-card__value--empty {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-lg);
  font-weight: var(--lcl-font-weight-semibold);
  line-height: var(--lcl-line-height-compact);
  opacity: var(--lcl-opacity-muted);
  text-align: center;
}

.sensor-data-chart-card .lcl-sparkline {
  color: var(--lcl-color-status-ok-text);
  height: calc(var(--lcl-size-compact-control-min-height) + var(--lcl-spacing-lg));
}

.sensor-data-chart-card--empty .lcl-sparkline {
  display: none;
}

.sensor-data-chart-card .lcl-sparkline path {
  stroke-width: var(--lcl-border-width-sm);
}
'''
new_theme = '''.sensor-metric-grid {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sensor-data-metric-card {
  background: var(--lcl-color-surface-muted);
  border-radius: var(--lcl-radius-md);
  display: grid;
  gap: var(--lcl-spacing-xs);
  padding: var(--lcl-spacing-md);
}

.sensor-data-metric-card__label {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-semibold);
}

.sensor-data-metric-card__value {
  color: var(--lcl-color-text);
  font-size: calc(var(--lcl-font-size-2xl) + var(--lcl-spacing-sm));
  font-weight: 700;
  line-height: var(--lcl-line-height-tight);
}

.sensor-data-metric-card--empty .sensor-data-metric-card__value,
.sensor-data-metric-card__value--empty {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-lg);
  opacity: var(--lcl-opacity-muted);
}
'''
if old_theme not in theme:
    raise SystemExit('theme.css: chart CSS block not found')
write(theme_path, theme.replace(old_theme, new_theme, 1))

# Remove generic Sparkline primitive from UI package.
ui_index = 'packages/ui/src/index.ts'
index_text = read(ui_index)
index_text = index_text.replace("export * from './primitives/Sparkline.js';\n", '')
write(ui_index, index_text)
ui_css_path = 'packages/ui/src/styles.css'
ui_css = read(ui_css_path)
ui_css, count = re.subn(
    r"\n\.lcl-sparkline \{.*?\n\.lcl-sparkline--empty \{.*?\n\}\n",
    '\n',
    ui_css,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit(f'packages/ui/src/styles.css: expected sparkline block once, got {count}')
write(ui_css_path, ui_css)
for path in (
    'packages/ui/src/primitives/Sparkline.tsx',
    'packages/ui/src/primitives/sparklinePath.ts',
    'packages/ui/src/primitives/sparklinePath.test.ts'
):
    Path(path).unlink()

# Locales: remove chart/history actions; keep PVVX time messages accurate.
translations = {
    'en.ts': (
        "      pvvxMobileOnly: 'Xiaomi/PVVX operations require the mobile app and a BLE connection.',",
        "      pvvxOnlyXiaomi: 'Time setting is available only for Xiaomi/PVVX.',"
    ),
    'pl.ts': (
        "      pvvxMobileOnly: 'Operacje Xiaomi/PVVX wymagają aplikacji mobilnej i połączenia BLE.',",
        "      pvvxOnlyXiaomi: 'Ustawianie czasu jest dostępne tylko dla Xiaomi/PVVX.',"
    ),
    'de.ts': (
        "      pvvxMobileOnly: 'Xiaomi/PVVX-Vorgänge erfordern die mobile App und eine BLE-Verbindung.',",
        "      pvvxOnlyXiaomi: 'Die Zeiteinstellung ist nur für Xiaomi/PVVX verfügbar.',"
    ),
    'es.ts': (
        "      pvvxMobileOnly: 'Las operaciones de Xiaomi/PVVX requieren la app móvil y una conexión BLE.',",
        "      pvvxOnlyXiaomi: 'El ajuste de hora solo está disponible para Xiaomi/PVVX.',"
    ),
    'fr.ts': (
        "      pvvxMobileOnly: 'Les opérations Xiaomi/PVVX nécessitent l’application mobile et une connexion BLE.',",
        "      pvvxOnlyXiaomi: 'Le réglage de l’heure est disponible uniquement pour Xiaomi/PVVX.',"
    ),
    'it.ts': (
        "      pvvxMobileOnly: 'Le operazioni Xiaomi/PVVX richiedono l’app mobile e una connessione BLE.',",
        "      pvvxOnlyXiaomi: 'L’impostazione dell’ora è disponibile solo per Xiaomi/PVVX.',"
    ),
    'ptBr.ts': (
        "      pvvxMobileOnly: 'As operações Xiaomi/PVVX exigem o app móvel e uma conexão BLE.',",
        "      pvvxOnlyXiaomi: 'O ajuste de hora está disponível apenas para Xiaomi/PVVX.',"
    )
}
remove_locale_keys = {
    'pvvxHistory',
    'pvvxHistoryLoadedDetail',
    'pvvxHistoryLoadedTitle',
    'pvvxHistoryLoading',
    'pvvxHistoryTitle',
    'temperatureChartLabel',
    'humidityChartLabel'
}
for filename, (mobile_line, xiaomi_line) in translations.items():
    path = f'apps/mobile/src/app/locales/{filename}'
    lines = read(path).splitlines()
    output = []
    mobile_seen = False
    xiaomi_seen = False
    for line in lines:
        stripped = line.strip()
        key = stripped.split(':', 1)[0] if ':' in stripped else ''
        if key in remove_locale_keys:
            continue
        if stripped.startswith('pvvxMobileOnly:'):
            output.append(mobile_line)
            mobile_seen = True
            continue
        if stripped.startswith('pvvxOnlyXiaomi:'):
            output.append(xiaomi_line)
            xiaomi_seen = True
            continue
        output.append(line)
    if not mobile_seen or not xiaomi_seen:
        raise SystemExit(f'{path}: expected PVVX message keys')
    write(path, '\n'.join(output) + '\n')

# Hardware setup tests: remove history mocks/tests and chart assertions, retain live data/time coverage.
test_path = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
test = read(test_path)
test = test.replace('  historyCalls: 0,\n  stopCountAtHistoryStart: 0,\n', '')
test, count = re.subn(
    r"    readPvvxMemoHistory: vi\.fn\(async \(\{ sensorId \}: \{ sensorId: string \}\) => \{.*?\n    \}\),\n    setPvvxDeviceTime:",
    '    setPvvxDeviceTime:',
    test,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit('hardware-setup.test.tsx: history mock block not found')
test = test.replace('    pvvxGattMock.historyCalls = 0;\n    pvvxGattMock.stopCountAtHistoryStart = 0;\n', '')
test = re.sub(
    r"\n    expect\(\n      screen\.getByRole\('img', \{ name: 'Wykres temperatury: Xiaomi salon' \}\)\n    \)\.toHaveClass\('lcl-sparkline'\);\n    expect\(\n      screen\.getByRole\('img', \{ name: 'Wykres wilgotności: Xiaomi salon' \}\)\n    \)\.toHaveClass\('lcl-sparkline'\);",
    '',
    test,
    count=1
)
test = re.sub(
    r"\n    expect\(\n      within\(sensorSettingsDialog\)\.getByRole\('button', \{ name: 'Pobierz historię' \}\)\n    \)\.toHaveAttribute\('title', 'Połącz z Xiaomi/PVVX i pobierz zapisane odczyty'\);",
    '',
    test,
    count=1
)
test, count = re.subn(
    r"\n  it\('pauses saved thermometer live scan before opening a Xiaomi PVVX GATT history session', async \(\) => \{.*?\n  \}\);\n\n  it\('keeps Xiaomi PVVX history manual while saved thermometer live scan is active', async \(\) => \{.*?\n  \}\);\n",
    '\n',
    test,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit('hardware-setup.test.tsx: PVVX history tests not found')
for forbidden in ('historyCalls', 'stopCountAtHistoryStart', 'Pobierz historię', 'Wykres temperatury', 'lcl-sparkline'):
    if forbidden in test:
        raise SystemExit(f'hardware-setup.test.tsx: forbidden reference remains: {forbidden}')
write(test_path, test)

# Documentation: make the product decision explicit and remove stale chart roadmap claims.
plan_path = 'docs/plan.md'
plan = read(plan_path)
plan, count = re.subn(
    r"### Sensor history and charts\n.*?### Setup health checks and reliability testing",
    '''### Sensor display policy

The mobile app intentionally keeps sensor cards focused on current live readings.
Historical plotting and local sample-history persistence are out of scope: supported
thermometers already provide better native history views, while Local Climate Link
needs only fresh values for setup, diagnostics, and automation control. Xiaomi/PVVX
time synchronization remains available as a setup utility.

### Setup health checks and reliability testing''',
    plan,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit('docs/plan.md: chart roadmap section not found')
write(plan_path, plan)

compat_path = 'docs/compatibility/sensors.md'
compat = read(compat_path)
compat = compat.replace(
    '  - the mobile app can connect to PVVX over phone BLE during setup to import stored memo readings and set thermometer time\n  - mobile charts keep a bounded local sample buffer so recent readings survive app restarts\n',
    '  - the mobile app can connect to PVVX over phone BLE during setup to set thermometer time\n  - the mobile app shows current live readings without maintaining local chart history\n'
)
compat = compat.replace(
    '  - mobile charts use live advertisement samples only, kept in a bounded local sample buffer across app restarts\n  - stored TP357 history needs a separate phone GATT reader and is planned as day-history first\n',
    '  - the mobile app shows current TP357 advertisement values without maintaining local chart history\n'
)
write(compat_path, compat)

parser_path = 'docs/parser-sources.md'
parser = read(parser_path)
parser, count = re.subn(
    r"Implementation plan for TP357 stored history:\n\n```text\n.*?```\n\nCurrent implementation decision:\n\n```text\n.*?```",
    '''Current implementation decision:

```text
TP357 stored history is not exposed by the mobile app. Local Climate Link uses
passive advertisements for current TP357 values only. Xiaomi/PVVX memo history is
also not surfaced in the app; the PVVX GATT path retained by the product is time
synchronization. Historical plotting is intentionally delegated to thermometer-native
software rather than duplicated in Local Climate Link.
```''',
    parser,
    count=1,
    flags=re.S
)
if count != 1:
    raise SystemExit('docs/parser-sources.md: history plan section not found')
write(parser_path, parser)

handoff_path = 'docs/HANDOFF_NEXT_CHAT.md'
handoff = read(handoff_path)
handoff = handoff.replace(
    'Do not resume chart/history work unless explicitly requested.',
    'Sensor chart/history UI is intentionally removed; do not reintroduce it without an explicit product decision.'
)
write(handoff_path, handoff)

print('REMOVE_SENSOR_CHARTS_PATCH_OK=1')
