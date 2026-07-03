import {
  parseBthomeV2Advertisement,
  parseTp357Advertisement,
  type BleCoreError,
  type BleScanner,
  type NormalizedBleAdvertisement,
  type ParsedSensorAdvertisement
} from '@lcl/ble-core';
import type { BleDiscoveryCandidate } from './schemas.js';
import { normalizeRuntimeAddress } from './validation.js';
import { t } from '../../app/i18n.js';

const DEFAULT_PHONE_BLE_SCAN_TIMEOUT_MS = 20000;

type PhoneBleScanOptions = {
  scanner: BleScanner;
  timeoutMs?: number;
  onCandidate?(candidate: BleDiscoveryCandidate): void;
};

export type PhoneBleScanOutcome = {
  candidates: BleDiscoveryCandidate[];
};

const parseSupportedAdvertisement = (
  advertisement: NormalizedBleAdvertisement
): ParsedSensorAdvertisement | null => {
  const bthome = parseBthomeV2Advertisement(advertisement);
  if (bthome.ok) {
    return bthome.value;
  }

  const tp357 = parseTp357Advertisement(advertisement);
  return tp357.ok ? tp357.value : null;
};

const toCandidate = (parsed: ParsedSensorAdvertisement): BleDiscoveryCandidate | null => {
  let runtimeAddress: string;
  try {
    runtimeAddress = normalizeRuntimeAddress(parsed.measurement.sensorId);
  } catch {
    return null;
  }

  return {
    runtimeAddress,
    profileId: parsed.profileId,
    temperatureC: parsed.measurement.temperatureC,
    humidityPct: parsed.measurement.humidityPct,
    batteryPct: parsed.measurement.batteryPct,
    voltageV: parsed.measurement.voltageV,
    rssi: parsed.measurement.rssi,
    seenAt: parsed.measurement.seenAtMs
  };
};

const upsertCandidate = (
  candidates: BleDiscoveryCandidate[],
  candidate: BleDiscoveryCandidate
): BleDiscoveryCandidate[] => {
  const existingIndex = candidates.findIndex(
    (item) => item.runtimeAddress.toUpperCase() === candidate.runtimeAddress.toUpperCase()
  );
  if (existingIndex === -1) {
    return [...candidates, candidate];
  }

  const existing = candidates[existingIndex];
  if (!existing) {
    return candidates;
  }

  const merged = {
    ...existing,
    ...candidate,
    temperatureC: candidate.temperatureC ?? existing.temperatureC,
    humidityPct: candidate.humidityPct ?? existing.humidityPct,
    batteryPct: candidate.batteryPct ?? existing.batteryPct,
    voltageV: candidate.voltageV ?? existing.voltageV,
    rssi: candidate.rssi ?? existing.rssi,
    seenAt: candidate.seenAt ?? existing.seenAt
  };

  return candidates.map((item, index) => (index === existingIndex ? merged : item));
};

export const mergeBleDiscoveryCandidate = (
  current: BleDiscoveryCandidate[],
  candidate: BleDiscoveryCandidate
): BleDiscoveryCandidate[] => upsertCandidate(current, candidate);

const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ? error.message
      : '';

const isBleCoreError = (error: unknown): error is BleCoreError =>
  typeof error === 'object' &&
  error !== null &&
  'kind' in error &&
  typeof error.kind === 'string';

const phoneBleScanErrorMessage = (error: unknown): string => {
  const message = errorMessage(error);

  if (
    isBleCoreError(error) &&
    error.kind === 'ble-unavailable' &&
    /disabled/i.test(message)
  ) {
    return t('hardware.sensor.phoneBleDisabled');
  }

  if (
    (isBleCoreError(error) && error.kind === 'permission-denied') ||
    /permission denied|Android Location services are off/i.test(message)
  ) {
    return t('hardware.sensor.phoneBlePermissionDenied');
  }

  if (
    /Phone BLE scan is unavailable|Web Bluetooth API not available|requestLEScan|bluetooth.*not.*available/i.test(
      message
    )
  ) {
    return t('hardware.sensor.phoneBleUnavailableInBrowser');
  }

  return t('hardware.sensor.phoneBleGenericFailed');
};

export const scanPhoneBleSensors = async ({
  scanner,
  timeoutMs = DEFAULT_PHONE_BLE_SCAN_TIMEOUT_MS,
  onCandidate
}: PhoneBleScanOptions): Promise<PhoneBleScanOutcome> => {
  let candidates: BleDiscoveryCandidate[] = [];
  let unsupportedRuntimeAddressCount = 0;

  try {
    for await (const advertisement of scanner.startScan({ timeoutMs })) {
      const parsed = parseSupportedAdvertisement(advertisement);
      if (!parsed) {
        continue;
      }

      const candidate = toCandidate(parsed);
      if (!candidate) {
        unsupportedRuntimeAddressCount += 1;
        continue;
      }

      candidates = mergeBleDiscoveryCandidate(candidates, candidate);
      onCandidate?.(candidate);
    }
  } catch (error) {
    throw new Error(phoneBleScanErrorMessage(error));
  } finally {
    await scanner.stopScan();
  }

  if (candidates.length === 0 && unsupportedRuntimeAddressCount > 0) {
    throw new Error(t('hardware.sensor.phoneBleNoRuntimeAddress'));
  }

  return { candidates };
};
