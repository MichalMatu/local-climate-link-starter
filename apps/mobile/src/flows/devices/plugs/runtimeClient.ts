import {
  RpcShellyClient,
  RpcShellyInventoryClient,
  RpcShellyScheduleClient
} from '@lcl/shelly-client';
import { createShellyTransport } from '../../hardware-setup/shellyRequests.js';

export type PlugRuntimeClients = {
  device: Pick<
    RpcShellyClient,
    | 'getDeviceInfo'
    | 'getStatus'
    | 'setRelayOn'
    | 'setRelayOff'
    | 'stopScript'
    | 'deleteScript'
  >;
  inventory: Pick<RpcShellyInventoryClient, 'listMethods' | 'listScripts' | 'readRelay'>;
  schedules: Pick<RpcShellyScheduleClient, 'list'>;
};

export const createPlugRuntimeClients = (baseUrl: string): PlugRuntimeClients => {
  const transport = createShellyTransport(baseUrl);
  return {
    device: new RpcShellyClient(transport),
    inventory: new RpcShellyInventoryClient(transport),
    schedules: new RpcShellyScheduleClient(transport)
  };
};
