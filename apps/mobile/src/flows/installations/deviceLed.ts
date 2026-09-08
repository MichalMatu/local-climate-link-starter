import {
  createLedOffPatch,
  createRelayStateLedPatch,
  FetchShellyRpcTransport,
  RpcShellyPlugsUiClient,
  type Result,
  type ShellyPlugsUiReadResult
} from '@lcl/shelly-client';
import type { InstalledAutomation } from './model.js';

export type InstalledShellyLedPreset = 'relay-state' | 'off';

export const installedShellyLedSettingsQueryKey = (
  installation: InstalledAutomation
) =>
  [
    'installed-shelly-led-settings',
    installation.shelly.deviceId,
    installation.shelly.baseUrl
  ] as const;

const createClient = (installation: InstalledAutomation) =>
  new RpcShellyPlugsUiClient(
    new FetchShellyRpcTransport({
      baseUrl: installation.shelly.baseUrl,
      defaultTimeoutMs: 5000
    })
  );

const unwrap = <T>(result: Result<T>): T => {
  if (result.ok) {
    return result.value;
  }
  throw new Error(
    result.error.technicalMessage ??
      result.error.userMessageKey ??
      'Shelly PLUGS_UI request failed.'
  );
};

export const readInstalledShellyLedSettings = async (
  installation: InstalledAutomation
): Promise<ShellyPlugsUiReadResult> => unwrap(await createClient(installation).read());

export const applyInstalledShellyLedPreset = async (
  installation: InstalledAutomation,
  preset: InstalledShellyLedPreset
): Promise<ShellyPlugsUiReadResult> => {
  const client = createClient(installation);
  unwrap(
    await client.setLeds(
      preset === 'relay-state' ? createRelayStateLedPatch() : createLedOffPatch()
    )
  );
  return unwrap(await client.read());
};
