from pathlib import Path

ROOT = Path('.')


def path(rel: str) -> Path:
    return ROOT / rel


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


runtime_hook = path('apps/mobile/src/flows/hardware-setup/useSensorRuntimeReadings.ts')
if runtime_hook.exists():
    raise SystemExit(f'unexpected existing file: {runtime_hook}')
runtime_hook.write_text("""import { useQueries } from '@tanstack/react-query';
import type { ClimateInstalledAutomation } from '../installations/model.js';
import { fetchInstalledAutomationDiagnostics } from '../installations/runtimeDiagnostics.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { installedAutomationDiagnosticsQueryKey } from '../installations/useInstalledAutomationRuntime.js';
import type { SensorDraftDevice } from './setupDraftStore.js';

const SENSOR_RUNTIME_REFRESH_MS = 5_000;

const normalizeSensorId = (sensorId: string): string => sensorId.trim().toUpperCase();

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const calculateSensorVpdKpa = (
  temperatureC: number | null | undefined,
  humidityPct: number | null | undefined
): number | undefined => {
  if (
    typeof temperatureC !== 'number' ||
    !Number.isFinite(temperatureC) ||
    temperatureC <= -237.3 ||
    typeof humidityPct !== 'number' ||
    !Number.isFinite(humidityPct) ||
    humidityPct < 0 ||
    humidityPct > 100
  ) {
    return undefined;
  }

  const saturationVaporPressure =
    0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
  return saturationVaporPressure * (1 - humidityPct / 100);
};

export type SensorRuntimeReading = {
  sensorId: string;
  source: 'shelly-runtime';
  shellyName: string;
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  vpdKpa?: number | undefined;
  batteryPct?: number | undefined;
  rssi?: number | undefined;
  seenAtMs: number;
  stale: boolean;
};

const isClimateInstallation = (
  installation: ReturnType<typeof useInstalledAutomationStore.getState>['installations'][number]
): installation is ClimateInstalledAutomation => installation.kind === 'climate';

export const useSensorRuntimeReadings = (
  sensorDevices: readonly SensorDraftDevice[]
): Record<string, SensorRuntimeReading> => {
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
      refetchInterval: SENSOR_RUNTIME_REFRESH_MS,
      refetchIntervalInBackground: false,
      refetchOnMount: 'always' as const,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }))
  });

  const readings: Record<string, SensorRuntimeReading> = {};

  runtimeInstallations.forEach((installation, index) => {
    const query = runtimeQueries[index];
    const snapshot = query?.data;
    if (!snapshot) return;

    const diagnostics = snapshot.diagnostics;
    const temperatureC = finiteNumber(diagnostics.lastTemp);
    const humidityPct = finiteNumber(diagnostics.lastHumidity);
    const lastSeenUptimeMs = finiteNumber(diagnostics.lastSeenUptimeMs);
    if (temperatureC === undefined && humidityPct === undefined && lastSeenUptimeMs === undefined) {
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
    const reading: SensorRuntimeReading = {
      sensorId,
      source: 'shelly-runtime',
      shellyName: installation.shelly.name,
      temperatureC,
      humidityPct,
      vpdKpa: calculateSensorVpdKpa(temperatureC, humidityPct),
      batteryPct: finiteNumber(diagnostics.lastBattery),
      rssi: finiteNumber(diagnostics.lastRssi),
      seenAtMs: Math.max(0, fetchedAtMs - ageMs),
      stale:
        diagnostics.dataState === 'st' ||
        (lastSeenUptimeMs !== undefined &&
          currentUptimeMs !== undefined &&
          ageMs > snapshot.rule.staleTimeoutSec * 1000)
    };

    const existing = readings[sensorId];
    if (
      !existing ||
      (existing.stale && !reading.stale) ||
      (existing.stale === reading.stale && reading.seenAtMs > existing.seenAtMs)
    ) {
      readings[sensorId] = reading;
    }
  });

  return readings;
};
""")

page = path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
text = page.read_text()
text = replace_once(
    text,
    "import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';\n",
    "import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';\nimport { useSensorRuntimeReadings } from '../../../flows/hardware-setup/useSensorRuntimeReadings.js';\n",
    'SensorSetupPage import'
)
text = replace_once(
    text,
    "  const sensorDeviceCount = flow.sensorDevices.length;\n  const shouldRunSavedSensorLiveScan =\n",
    "  const sensorDeviceCount = flow.sensorDevices.length;\n  const sensorRuntimeReadings = useSensorRuntimeReadings(flow.sensorDevices);\n  const shouldRunSavedSensorLiveScan =\n",
    'SensorSetupPage runtime hook'
)
text = replace_once(
    text,
    "            samples={readingsForSensor(device)}\n            isEditing={editingSensorId === device.id}\n",
    "            samples={readingsForSensor(device)}\n            runtimeReading={\n              sensorRuntimeReadings[device.runtimeAddress.toUpperCase()] ?? null\n            }\n            isEditing={editingSensorId === device.id}\n",
    'SensorSetupPage card runtime prop'
)
page.write_text(text)

presentation = path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx')
text = presentation.read_text()
text = replace_once(
    text,
    "import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';\n",
    "import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';\nimport {\n  calculateSensorVpdKpa,\n  type SensorRuntimeReading\n} from '../../../flows/hardware-setup/useSensorRuntimeReadings.js';\n",
    'SensorSetupPresentation runtime import'
)
text = replace_once(
    text,
    "const formatSeenAt = (\n  sample: SensorReadingSample | null,\n  locale: string,\n  missingLabel: string\n): string =>\n  sample\n    ? new Intl.DateTimeFormat(locale, {\n        hour: '2-digit',\n        minute: '2-digit'\n      }).format(new Date(sample.seenAtMs))\n    : missingLabel;\n",
    "const formatSeenAt = (\n  seenAtMs: number | null,\n  locale: string,\n  missingLabel: string\n): string =>\n  seenAtMs === null\n    ? missingLabel\n    : new Intl.DateTimeFormat(locale, {\n        hour: '2-digit',\n        minute: '2-digit'\n      }).format(new Date(seenAtMs));\n",
    'formatSeenAt'
)
text = replace_once(
    text,
    "  samples: readonly SensorReadingSample[];\n  isEditing: boolean;\n",
    "  samples: readonly SensorReadingSample[];\n  runtimeReading: SensorRuntimeReading | null;\n  isEditing: boolean;\n",
    'SavedSensorCard props'
)
text = replace_once(
    text,
    "  device,\n  samples,\n  isEditing,\n",
    "  device,\n  samples,\n  runtimeReading,\n  isEditing,\n",
    'SavedSensorCard destructure'
)
var_start = text.index("  const temperatureSample = latestNumericSample(samples, 'temperatureC');")
var_end = text.index("\n\n  useEffect(() =>", var_start)
new_vars = """  const temperatureSample = latestNumericSample(samples, 'temperatureC');
  const humiditySample = latestNumericSample(samples, 'humidityPct');
  const latest = latestSample(samples);
  const batterySample = latestBatterySample(samples);
  const rssiSample = latestNumericSample(samples, 'rssi');
  const usingShellyRuntime = runtimeReading !== null;
  const liveTemperatureC = runtimeReading
    ? runtimeReading.temperatureC
    : temperatureSample?.temperatureC;
  const liveHumidityPct = runtimeReading
    ? runtimeReading.humidityPct
    : humiditySample?.humidityPct;
  const liveVpdKpa = runtimeReading
    ? runtimeReading.vpdKpa
    : calculateSensorVpdKpa(liveTemperatureC, liveHumidityPct);
  const liveBattery = runtimeReading
    ? formatSensorMetric(runtimeReading.batteryPct, '%', 0, '—')
    : formatBattery(batterySample, '—');
  const liveRssi = formatSensorMetric(
    runtimeReading ? runtimeReading.rssi : rssiSample?.rssi,
    ' dBm',
    0,
    '—'
  );
  const liveSeenAtMs = runtimeReading ? runtimeReading.seenAtMs : (latest?.seenAtMs ?? null);
  const previousSeenAtMsRef = useRef<number | null>(liveSeenAtMs);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSamplePulseActive, setIsSamplePulseActive] = useState(false);
  const [samplePulseSequence, setSamplePulseSequence] = useState(0);"""
text = text[:var_start] + new_vars + text[var_end:]
text = text.replace('latestSeenAtMs', 'liveSeenAtMs')
header_start = text.index('      <div className="sensor-card-header">')
metric_start = text.index('      <div className="sensor-metric-grid">', header_start)
status_start = text.index('      <div className="sensor-status-strip">', metric_start)
new_header = """      <div className="sensor-card-header">
        <span
          className={`sensor-card-leading-icon${
            isSamplePulseActive ? ' sensor-card-leading-icon--fresh' : ''
          }`}
          aria-hidden="true"
        >
          <IconTemperature
            key={samplePulseSequence}
            className="sensor-card-leading-icon__icon"
          />
        </span>
        <div className="sensor-card-title-row">
          {isEditing ? (
            <input
              autoFocus
              className="sensor-card-name-input"
              aria-label={t('hardware.sensor.nameLabel')}
              type="text"
              value={device.name}
              onBlur={onEditEnd}
              onChange={(event) => onNameChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.currentTarget.blur();
                }
              }}
            />
          ) : (
            <h3 className="sensor-card-title">{device.name}</h3>
          )}
          <span
            className={`sensor-card-live-values${
              runtimeReading?.stale ? ' sensor-card-live-values--stale' : ''
            }`}
          >
            {runtimeReading ? (
              <span
                className="sensor-card-source"
                title={`${t('hardware.rule.selectedShelly')}: ${runtimeReading.shellyName}`}
              >
                <IconPlug className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : latest?.source === 'phone-scan' ? (
              <span
                className="sensor-card-source"
                title={t('hardware.sensor.scanPhoneTitle')}
              >
                <IconDeviceMobile className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : latest?.source === 'shelly-scan' ? (
              <span className="sensor-card-source" title={t('hardware.nav.shellyTitle')}>
                <IconPlug className="icon-action__svg" aria-hidden="true" />
              </span>
            ) : null}
            <strong className="sensor-card-live-values__metrics">
              {formatSensorMetric(liveTemperatureC, ' °C', 1, '— °C')} ·{' '}
              {formatSensorMetric(liveHumidityPct, ' %', 1, '— %')} ·{' '}
              {formatSensorMetric(liveVpdKpa, ' kPa', 2, '— kPa')}
            </strong>
          </span>
        </div>
        <div className="sensor-card-actions">
          {!isEditing && (
            <button
              className="icon-action rule-summary-icon-action"
              type="button"
              aria-label={t('hardware.sensor.nameLabel')}
              title={t('hardware.sensor.nameLabel')}
              onClick={onEditStart}
            >
              <IconPencil className="icon-action__svg" aria-hidden="true" />
            </button>
          )}
          {device.profileId === 'xiaomi_lywsd03mmc_bthome_v2' && (
            <button
              className="icon-action"
              type="button"
              disabled={pvvxTimePending}
              aria-label={t('hardware.sensor.pvvxSetTimeTitle')}
              title={t('hardware.sensor.pvvxSetTimeTitle')}
              onClick={onPvvxSetTime}
            >
              <IconClock className="icon-action__svg" aria-hidden="true" />
            </button>
          )}
          <button
            className="icon-action icon-action--danger"
            type="button"
            aria-label={t('hardware.sensor.deleteTitle')}
            title={t('hardware.sensor.deleteTitle')}
            onClick={onRemove}
          >
            <IconTrash className="icon-action__svg" aria-hidden="true" />
          </button>
        </div>
      </div>"""
text = text[:header_start] + new_header + "\n\n" + text[status_start:]
status_start = text.index('      <div className="sensor-status-strip">')
details_start = text.index('      <details className="sensor-card-details-disclosure">', status_start)
new_status = """      <div className="sensor-status-strip">
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('hardware.metrics.battery')}: ${liveBattery}`}
          title={t('hardware.metrics.battery')}
        >
          <IconBattery aria-hidden="true" />
          <strong>{liveBattery}</strong>
        </span>
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('common.rssi')}: ${liveRssi}`}
          title={t('common.rssi')}
        >
          <IconWifi aria-hidden="true" />
          <strong>{liveRssi}</strong>
        </span>
        <span
          className="sensor-status-strip__item"
          aria-label={`${t('hardware.metrics.lastMeasurement')}: ${formatSeenAt(
            liveSeenAtMs,
            locale,
            '—'
          )}`}
          title={t('hardware.metrics.lastMeasurement')}
        >
          <IconClock aria-hidden="true" />
          <strong>{formatSeenAt(liveSeenAtMs, locale, '—')}</strong>
        </span>
      </div>

"""
text = text[:status_start] + new_status + text[details_start:]
presentation.write_text(text)

css = path('apps/mobile/src/theme/theme.css')
css_text = css.read_text()
marker = '.sensor-card-live-values {'
if marker in css_text:
    raise SystemExit('sensor live values css already exists')
css_text += """

.sensor-card-title-row {
  flex-wrap: wrap;
  justify-content: space-between;
}

.sensor-card-live-values {
  align-items: center;
  color: var(--lcl-color-text-muted);
  display: inline-flex;
  flex: 0 0 auto;
  gap: var(--lcl-spacing-xs);
  margin-left: auto;
  min-width: 0;
}

.sensor-card-live-values__metrics {
  color: var(--lcl-color-text);
  font-size: var(--lcl-font-size-sm);
  font-variant-numeric: tabular-nums;
  line-height: var(--lcl-line-height-tight);
  white-space: nowrap;
}

.sensor-card-live-values--stale {
  opacity: var(--lcl-opacity-muted);
}
"""
css.write_text(css_text)

test = path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.test.tsx')
text = test.read_text()
text = replace_once(
    text,
    "import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';\n",
    "import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';\nimport type { SensorRuntimeReading } from '../../../flows/hardware-setup/useSensorRuntimeReadings.js';\n",
    'SensorSetupPresentation test runtime import'
)
text = replace_once(
    text,
    "const card = (samples: readonly SensorReadingSample[]) => (\n",
    "const card = (\n  samples: readonly SensorReadingSample[],\n  runtimeReading: SensorRuntimeReading | null = null\n) => (\n",
    'SensorSetupPresentation test card signature'
)
text = replace_once(
    text,
    "      samples={samples}\n      isEditing={false}\n",
    "      samples={samples}\n      runtimeReading={runtimeReading}\n      isEditing={false}\n",
    'SensorSetupPresentation test runtime prop'
)
insert_before = "  it('pulses only when seenAtMs strictly advances', () => {\n"
if text.count(insert_before) != 1:
    raise SystemExit('SensorSetupPresentation test insertion point missing')
extra_tests = """  it('shows compact phone live values with the phone source icon', () => {
    const { container } = render(card([sample(1000)]));
    const metrics = container.querySelector('.sensor-card-live-values__metrics');

    expect(metrics).toHaveTextContent('21.3 °C · 45.7 % · 1.38 kPa');
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-device-mobile')
    ).not.toBeNull();
    expect(container.querySelector('.sensor-card-live-values .tabler-icon-plug')).toBeNull();
    expect(container.querySelector('.sensor-metric-grid')).toBeNull();
  });

  it('prefers installed Shelly runtime values and source over phone samples', () => {
    const runtimeReading: SensorRuntimeReading = {
      sensorId: device.runtimeAddress,
      source: 'shelly-runtime',
      shellyName: 'Salon',
      temperatureC: 22.6,
      humidityPct: 58.4,
      vpdKpa: 1.12,
      batteryPct: 87,
      rssi: -64,
      seenAtMs: 2000,
      stale: false
    };
    const { container } = render(card([sample(1000)], runtimeReading));
    const metrics = container.querySelector('.sensor-card-live-values__metrics');

    expect(metrics).toHaveTextContent('22.6 °C · 58.4 % · 1.12 kPa');
    expect(container.querySelector('.sensor-card-live-values .tabler-icon-plug')).not.toBeNull();
    expect(
      container.querySelector('.sensor-card-live-values .tabler-icon-device-mobile')
    ).toBeNull();
  });

"""
text = text.replace(insert_before, extra_tests + insert_before, 1)
test.write_text(text)

print('Added compact thermometer live values with phone/Shelly source precedence')
