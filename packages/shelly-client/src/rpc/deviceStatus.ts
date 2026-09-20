import type {
  Result,
  ShellyClockStatus,
  ShellyComponentState,
  ShellyDeviceInfo,
  ShellyPlugTelemetry,
  ShellyStatus
} from '../model.js';
import {
  shellyDeviceInfoSchema,
  switchStatusSchema,
  sysStatusSchema,
  wifiStatusSchema
} from './validators.js';

const MIN_SYNCED_UNIX_TIME_SEC = 1_600_000_000;

const validationError = (message: string) => ({
  kind: 'validation-failed' as const,
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const componentState = (value: unknown): ShellyComponentState => {
  if (value === undefined || value === null) {
    return 'missing';
  }
  if (value === false) {
    return 'disabled';
  }
  if (value === true) {
    return 'enabled';
  }
  if (isRecord(value) && (value.enable === false || value.enabled === false)) {
    return 'disabled';
  }
  return isRecord(value) ? 'enabled' : 'missing';
};

const matterEnabled = (value: unknown): boolean =>
  value === true ||
  (isRecord(value) && (value.enable === true || value.enabled === true));

const toShellyPlugTelemetry = (
  switchStatus: ReturnType<typeof switchStatusSchema.safeParse>,
  wifiStatus: ReturnType<typeof wifiStatusSchema.safeParse>
): ShellyPlugTelemetry => {
  const telemetry: ShellyPlugTelemetry = {};
  if (switchStatus.success) {
    const data = switchStatus.data;
    if (data.apower !== undefined) telemetry.powerW = data.apower;
    if (data.voltage !== undefined) telemetry.voltageV = data.voltage;
    if (data.current !== undefined) telemetry.currentA = data.current;
    if (data.aenergy?.total !== undefined) telemetry.energyWh = data.aenergy.total;
    if (data.temperature?.tC !== undefined) {
      telemetry.deviceTemperatureC = data.temperature.tC;
    }
  }
  if (wifiStatus.success && wifiStatus.data.rssi !== undefined) {
    telemetry.wifiRssiDbm = wifiStatus.data.rssi;
  }
  return telemetry;
};

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toShellyClockStatus = (
  sysStatus: ReturnType<typeof sysStatusSchema.safeParse>
): ShellyClockStatus => {
  if (!sysStatus.success) {
    return { timeSynced: false };
  }

  const localTime =
    typeof sysStatus.data.time === 'string' && sysStatus.data.time.trim() !== ''
      ? sysStatus.data.time
      : undefined;
  const unixTimeSec = finiteNumber(sysStatus.data.unixtime);
  const uptimeSec = finiteNumber(sysStatus.data.uptime);
  const lastSyncUnixTimeSec = finiteNumber(sysStatus.data.last_sync_ts);

  return {
    ...(localTime ? { localTime } : {}),
    ...(unixTimeSec !== undefined ? { unixTimeSec } : {}),
    ...(uptimeSec !== undefined ? { uptimeSec } : {}),
    ...(lastSyncUnixTimeSec !== undefined ? { lastSyncUnixTimeSec } : {}),
    timeSynced: unixTimeSec !== undefined && unixTimeSec >= MIN_SYNCED_UNIX_TIME_SEC
  };
};

export const parseShellyDeviceInfoResponse = (
  value: unknown
): Result<ShellyDeviceInfo> => {
  const parsed = shellyDeviceInfoSchema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: validationError(parsed.error.message) };
};

export const parseShellyStatusResponse = (value: unknown): Result<ShellyStatus> => {
  const status = isRecord(value) ? value : {};
  const switchStatus = switchStatusSchema.safeParse(status['switch:0']);
  const wifiStatus = wifiStatusSchema.safeParse(status.wifi);
  const sysStatus = sysStatusSchema.safeParse(status.sys);

  return {
    ok: true,
    value: {
      matterEnabled: matterEnabled(status.matter),
      scripts: componentState(status.script),
      bluetooth: componentState(status.ble),
      relayOn: switchStatus.success ? switchStatus.data.output : false,
      telemetry: toShellyPlugTelemetry(switchStatus, wifiStatus),
      clock: toShellyClockStatus(sysStatus)
    }
  };
};
