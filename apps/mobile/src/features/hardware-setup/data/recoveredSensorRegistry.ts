import type { SensorDraftDevice } from './setupDraftPersistence.js';

const addressKey = (value: string): string | null => {
  const compact = value.trim().replace(/[:-]/g, '').toUpperCase();
  return /^[0-9A-F]{12}$/.test(compact) ? compact : null;
};

const canonicalAddress = (key: string): string => key.match(/.{2}/g)?.join(':') ?? key;

const sensorKey = (device: Pick<SensorDraftDevice, 'id' | 'runtimeAddress'>) =>
  addressKey(device.runtimeAddress) ?? addressKey(device.id);

export const mergeRecoveredSensorRegistry = (
  current: SensorDraftDevice[],
  recovered: readonly SensorDraftDevice[]
): SensorDraftDevice[] => {
  const known = new Set(
    current
      .map((device) => sensorKey(device))
      .filter((key): key is string => key !== null)
  );
  const additions: SensorDraftDevice[] = [];

  for (const candidate of recovered) {
    const key = sensorKey(candidate);
    if (key === null || known.has(key)) continue;
    known.add(key);
    const runtimeAddress = canonicalAddress(key);
    additions.push({
      id: runtimeAddress,
      name: candidate.name.trim() || runtimeAddress,
      runtimeAddress,
      profileId: candidate.profileId
    });
  }

  return additions.length === 0 ? current : [...current, ...additions];
};
