import { RpcShellyClient, type Result, type ShellyRpcTransport } from '@lcl/shelly-client';
import { createShellyBleTransport } from '../../../platform/shellyBleTransport.js';
import {
  buildVerifiedPlugBleCandidate,
  type PlugBleAdvertisement,
  type VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';

export const PLUG_BLE_GATT_RADIO_SETTLE_MS = 1200;

type DisconnectableShellyTransport = ShellyRpcTransport & {
  disconnect(): Promise<void>;
};

export type InspectPlugBleCandidateOptions = {
  radioSettleMs?: number;
};

export type InspectPlugBleCandidateDependencies = {
  createTransport?(deviceId: string): DisconnectableShellyTransport;
  sleepMs?(durationMs: number): Promise<void>;
};

const defaultSleep = (durationMs: number): Promise<void> =>
  durationMs <= 0
    ? Promise.resolve()
    : new Promise((resolve) => {
        window.setTimeout(resolve, durationMs);
      });

const unwrap = <T>(result: Result<T>, operation: string): T => {
  if (result.ok) {
    return result.value;
  }

  throw new Error(
    `${operation} failed: ${result.error.technicalMessage ?? result.error.kind}`
  );
};

export const inspectPlugBleCandidate = async (
  advertisement: PlugBleAdvertisement,
  options: InspectPlugBleCandidateOptions = {},
  dependencies: InspectPlugBleCandidateDependencies = {}
): Promise<VerifiedPlugBleCandidate> => {
  const sleepMs = dependencies.sleepMs ?? defaultSleep;
  await sleepMs(options.radioSettleMs ?? PLUG_BLE_GATT_RADIO_SETTLE_MS);

  const transport =
    dependencies.createTransport?.(advertisement.deviceId) ??
    createShellyBleTransport(advertisement.deviceId);

  try {
    const deviceInfo = unwrap(
      await new RpcShellyClient(transport).getDeviceInfo(),
      'Shelly.GetDeviceInfo'
    );

    return buildVerifiedPlugBleCandidate({
      bleDeviceId: advertisement.deviceId,
      advertisementName: advertisement.name,
      rssi: advertisement.rssi,
      deviceInfo
    });
  } finally {
    await transport.disconnect();
  }
};
