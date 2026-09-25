import type { BleScanner, NormalizedBleAdvertisement } from '@lcl/ble-core';
import type { PlugBleAdvertisement } from '../data/plugBleOnboarding.js';

export const DEFAULT_PLUG_BLE_SCAN_TIMEOUT_MS = 7000;

const isShellyPlugAdvertisement = (advertisement: NormalizedBleAdvertisement): boolean =>
  (advertisement.name ?? '').trim().toLowerCase().startsWith('shellyplug');

const toPlugAdvertisement = (
  advertisement: NormalizedBleAdvertisement
): PlugBleAdvertisement | null => {
  const name = advertisement.name?.trim() ?? '';
  const deviceId = advertisement.id.trim();
  if (!deviceId || !name || !isShellyPlugAdvertisement(advertisement)) {
    return null;
  }

  return {
    deviceId,
    name,
    rssi: advertisement.rssi ?? null
  };
};

const mergeCandidate = (
  candidates: Map<string, PlugBleAdvertisement>,
  candidate: PlugBleAdvertisement
): void => {
  const key = candidate.deviceId.toLowerCase();
  const current = candidates.get(key);
  if (!current) {
    candidates.set(key, candidate);
    return;
  }

  candidates.set(key, {
    ...current,
    ...candidate,
    rssi: candidate.rssi ?? current.rssi
  });
};

export type ScanPlugBleCandidatesOptions = {
  scanner: BleScanner;
  timeoutMs?: number;
  onCandidate?(candidate: PlugBleAdvertisement): void;
};

export const scanPlugBleCandidates = async ({
  scanner,
  timeoutMs = DEFAULT_PLUG_BLE_SCAN_TIMEOUT_MS,
  onCandidate
}: ScanPlugBleCandidatesOptions): Promise<PlugBleAdvertisement[]> => {
  const candidates = new Map<string, PlugBleAdvertisement>();

  try {
    for await (const advertisement of scanner.startScan({ timeoutMs })) {
      const candidate = toPlugAdvertisement(advertisement);
      if (!candidate) {
        continue;
      }
      mergeCandidate(candidates, candidate);
      onCandidate?.(candidate);
    }
  } finally {
    await scanner.stopScan().catch(() => undefined);
  }

  return [...candidates.values()].sort(
    (left, right) => (right.rssi ?? -999) - (left.rssi ?? -999)
  );
};
