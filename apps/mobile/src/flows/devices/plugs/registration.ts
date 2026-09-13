import { createSavedPlug, type SavedPlug } from './model.js';
import { createPlugRuntimeClients, type PlugRuntimeClients } from './runtimeClient.js';
import { fromShellyResult, type PlugRuntimeResult } from './runtimeResult.js';

export const checkPlugRegistration = async ({
  baseUrl,
  name,
  nowMs,
  clients = createPlugRuntimeClients(baseUrl)
}: {
  baseUrl: string;
  name: string;
  nowMs: number;
  clients?: PlugRuntimeClients;
}): Promise<PlugRuntimeResult<SavedPlug>> => {
  const identity = fromShellyResult(await clients.device.getDeviceInfo());
  if (!identity.ok) return identity;
  const plug = createSavedPlug({ deviceInfo: identity.value, baseUrl, name, nowMs });
  if (!plug.ok) return { ok: false, error: { kind: 'registration-invalid' } };
  const relay = fromShellyResult(await clients.inventory.readRelay());
  return relay.ok ? { ok: true, value: plug.value } : relay;
};
