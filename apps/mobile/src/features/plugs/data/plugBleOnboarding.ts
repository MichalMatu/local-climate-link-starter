import { normalizeShellyDeviceId, type ShellyDeviceInfo } from '@lcl/shelly-client';

export type PlugBleAdvertisement = {
  deviceId: string;
  name: string;
  rssi: number | null;
};

export type PlugBlePreview = {
  relayOn: boolean;
  powerW: number | null;
  voltageV: number | null;
  currentA: number | null;
  localTime: string | null;
};

export type VerifiedPlugBleCandidate = {
  bleDeviceId: string;
  advertisementName: string;
  rssi: number | null;
  physicalId: string;
  model: string;
  generation: number;
  firmwareId: string | null;
  matterEnabled: boolean | null;
  preview?: PlugBlePreview | null;
};

export const buildVerifiedPlugBleCandidate = (input: {
  bleDeviceId: string;
  advertisementName: string;
  rssi: number | null;
  deviceInfo: ShellyDeviceInfo;
}): VerifiedPlugBleCandidate => {
  const physicalId = normalizeShellyDeviceId(input.deviceInfo.id ?? '');
  if (!physicalId) {
    throw new Error('Shelly BLE identity is missing.');
  }

  return {
    bleDeviceId: input.bleDeviceId,
    advertisementName: input.advertisementName,
    rssi: input.rssi,
    physicalId,
    model: input.deviceInfo.model,
    generation: input.deviceInfo.gen,
    firmwareId: input.deviceInfo.firmwareId ?? null,
    matterEnabled: input.deviceInfo.matterEnabled ?? null
  };
};
