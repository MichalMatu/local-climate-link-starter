import {
  RpcShellyClient,
  RpcShellyWifiClient,
  normalizeShellyDeviceId,
  type Result,
  type ShellyRpcTransport
} from '@lcl/shelly-client';
import { createShellyBleTransport } from '../../../platform/shellyBleTransport.js';
import {
  classifyPlugBleNetwork,
  type PlugBleNetworkSnapshot,
  type VerifiedPlugBleCandidate
} from '../data/plugBleOnboarding.js';

const DEFAULT_PROVISIONING_VERIFY_DELAY_MS = 1200;

type DisconnectableShellyTransport = ShellyRpcTransport & {
  disconnect(): Promise<void>;
};

export type ProvisionPlugBleWifiInput = {
  candidate: VerifiedPlugBleCandidate;
  ssid: string;
  password: string;
};

export type ProvisionPlugBleWifiResult = {
  physicalId: string;
  restartRequired: boolean;
  verification: 'confirmed' | 'pending';
  network: PlugBleNetworkSnapshot | null;
};

export type ProvisionPlugBleWifiOptions = {
  verificationDelayMs?: number;
};

export type ProvisionPlugBleWifiDependencies = {
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

export const provisionPlugBleWifi = async (
  input: ProvisionPlugBleWifiInput,
  options: ProvisionPlugBleWifiOptions = {},
  dependencies: ProvisionPlugBleWifiDependencies = {}
): Promise<ProvisionPlugBleWifiResult> => {
  const transport =
    dependencies.createTransport?.(input.candidate.bleDeviceId) ??
    createShellyBleTransport(input.candidate.bleDeviceId);
  const sleepMs = dependencies.sleepMs ?? defaultSleep;

  try {
    const deviceInfo = unwrap(
      await new RpcShellyClient(transport).getDeviceInfo(),
      'Shelly.GetDeviceInfo'
    );
    const physicalId = normalizeShellyDeviceId(deviceInfo.id ?? '');
    if (!physicalId || physicalId !== input.candidate.physicalId) {
      throw new Error('Shelly BLE identity changed before Wi-Fi provisioning.');
    }

    const wifiClient = new RpcShellyWifiClient(transport);
    const mutation = unwrap(
      await wifiClient.setStation({
        ssid: input.ssid,
        password: input.password
      }),
      'WiFi.SetConfig'
    );

    await sleepMs(options.verificationDelayMs ?? DEFAULT_PROVISIONING_VERIFY_DELAY_MS);

    const readBack = await wifiClient.read();
    if (!readBack.ok) {
      return {
        physicalId,
        restartRequired: mutation.restart_required,
        verification: 'pending',
        network: null
      };
    }

    const network = classifyPlugBleNetwork(readBack.value);
    const configured = network.configuredSsids.includes(input.ssid);

    return {
      physicalId,
      restartRequired: mutation.restart_required,
      verification: configured ? 'confirmed' : 'pending',
      network
    };
  } finally {
    await transport.disconnect();
  }
};
