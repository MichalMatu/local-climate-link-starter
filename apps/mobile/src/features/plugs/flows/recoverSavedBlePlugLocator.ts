import { Capacitor } from '@capacitor/core';
import { CapacitorBleScanner } from '@lcl/ble-core';
import { normalizeShellyDeviceId } from '@lcl/shelly-client';
import type {
  PlugBleAdvertisement,
  VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { inspectPlugBleCandidate } from './inspectPlugBleCandidate.js';
import {
  DEFAULT_PLUG_BLE_SCAN_TIMEOUT_MS,
  scanPlugBleCandidates
} from './scanPlugBleCandidates.js';

export const PLUG_BLE_LOCATOR_RECOVERY_MAX_CANDIDATES = 6;

export type SavedBlePlugLocatorRecoveryOptions = {
  persistLocator(physicalId: string, bleDeviceId: string): void;
};

export type SavedBlePlugLocatorRecoveryDependencies = {
  scanCandidates?(): Promise<PlugBleAdvertisement[]>;
  inspectCandidate?(candidate: PlugBleAdvertisement): Promise<VerifiedPlugBleCandidate>;
};

type RecoveryScanCandidates = NonNullable<
  SavedBlePlugLocatorRecoveryDependencies['scanCandidates']
>;
type RecoveryInspectCandidate = NonNullable<
  SavedBlePlugLocatorRecoveryDependencies['inspectCandidate']
>;

const recoveryByPhysicalId = new Map<string, Promise<string>>();

const defaultScanCandidates: RecoveryScanCandidates = async () =>
  scanPlugBleCandidates({
    scanner: new CapacitorBleScanner({ platform: Capacitor.getPlatform() }),
    timeoutMs: DEFAULT_PLUG_BLE_SCAN_TIMEOUT_MS
  });

const defaultInspectCandidate: RecoveryInspectCandidate = (candidate) =>
  inspectPlugBleCandidate(candidate, { includePreview: false });

const prioritizeCandidates = (
  plug: SavedBlePlug,
  candidates: readonly PlugBleAdvertisement[]
): PlugBleAdvertisement[] => {
  const savedAdvertisementName = plug.advertisementName.trim().toLowerCase();
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      nameMatch:
        savedAdvertisementName.length > 0 &&
        candidate.name.trim().toLowerCase() === savedAdvertisementName
    }))
    .sort((left, right) => {
      const namePriority = Number(right.nameMatch) - Number(left.nameMatch);
      if (namePriority !== 0) return namePriority;
      const rssiPriority = (right.candidate.rssi ?? -999) - (left.candidate.rssi ?? -999);
      if (rssiPriority !== 0) return rssiPriority;
      return left.index - right.index;
    })
    .slice(0, PLUG_BLE_LOCATOR_RECOVERY_MAX_CANDIDATES)
    .map(({ candidate }) => candidate);
};

const recoverLocator = async (
  plug: SavedBlePlug,
  options: SavedBlePlugLocatorRecoveryOptions,
  scanCandidates: RecoveryScanCandidates,
  inspectCandidate: RecoveryInspectCandidate
): Promise<string> => {
  const canonicalPhysicalId = normalizeShellyDeviceId(plug.physicalId);
  const candidates = prioritizeCandidates(plug, await scanCandidates());

  for (const candidate of candidates) {
    let verified: VerifiedPlugBleCandidate;
    try {
      verified = await inspectCandidate(candidate);
    } catch {
      continue;
    }

    if (normalizeShellyDeviceId(verified.physicalId) !== canonicalPhysicalId) {
      continue;
    }

    options.persistLocator(plug.physicalId, verified.bleDeviceId);
    return verified.bleDeviceId;
  }

  throw new Error('Saved Shelly Plug could not be rediscovered over Bluetooth.');
};

export const recoverSavedBlePlugLocator = (
  plug: SavedBlePlug,
  options: SavedBlePlugLocatorRecoveryOptions,
  dependencies: SavedBlePlugLocatorRecoveryDependencies = {}
): Promise<string> => {
  const key = normalizeShellyDeviceId(plug.physicalId);
  const existing = recoveryByPhysicalId.get(key);
  if (existing) return existing;

  const recovery = recoverLocator(
    plug,
    options,
    dependencies.scanCandidates ?? defaultScanCandidates,
    dependencies.inspectCandidate ?? defaultInspectCandidate
  );
  recoveryByPhysicalId.set(key, recovery);

  const cleanup = () => {
    if (recoveryByPhysicalId.get(key) === recovery) {
      recoveryByPhysicalId.delete(key);
    }
  };
  void recovery.then(cleanup, cleanup);
  return recovery;
};
