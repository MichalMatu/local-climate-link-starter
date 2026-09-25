import { normalizeShellyDeviceId } from '@lcl/shelly-client';
import { z } from 'zod';
import type { VerifiedPlugBleCandidate } from './plugBleOnboarding.js';

export const SAVED_BLE_PLUG_VERSION = 1 as const;

export const savedBlePlugSchema = z.object({
  physicalId: z.string().min(1),
  name: z.string().min(1),
  bleDeviceId: z.string().min(1),
  advertisementName: z.string(),
  model: z.string(),
  generation: z.number().int().nonnegative(),
  firmwareId: z.string().nullable(),
  matterEnabled: z.boolean().nullable()
});

export type SavedBlePlug = z.infer<typeof savedBlePlugSchema>;

const defaultSavedBlePlugName = (candidate: VerifiedPlugBleCandidate): string =>
  candidate.advertisementName.trim() || candidate.model.trim() || candidate.physicalId;

export const savedBlePlugFromCandidate = (
  candidate: VerifiedPlugBleCandidate,
  existing?: SavedBlePlug
): SavedBlePlug => {
  const physicalId = normalizeShellyDeviceId(candidate.physicalId);
  if (!physicalId) {
    throw new Error('Shelly BLE identity is missing.');
  }

  return savedBlePlugSchema.parse({
    physicalId,
    name: existing?.name.trim() || defaultSavedBlePlugName(candidate),
    bleDeviceId: candidate.bleDeviceId,
    advertisementName: candidate.advertisementName,
    model: candidate.model,
    generation: candidate.generation,
    firmwareId: candidate.firmwareId,
    matterEnabled: candidate.matterEnabled
  });
};
