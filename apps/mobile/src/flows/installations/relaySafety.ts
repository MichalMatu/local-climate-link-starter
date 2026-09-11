import type { RpcShellyClient } from '@lcl/shelly-client';
import { unwrapShellyResult } from '../hardware-setup/shellyRequests.js';

export const forceRelayOffAndConfirm = async (
  client: RpcShellyClient,
  relayId: number
): Promise<void> => {
  unwrapShellyResult(await client.setRelayOff({ relayId }));
  const status = unwrapShellyResult(await client.getStatus());
  if (status.relayOn) {
    throw new Error('Shelly relay did not confirm OFF.');
  }
};
