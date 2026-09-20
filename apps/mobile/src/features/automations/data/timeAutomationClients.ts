import { RpcShellyClient, RpcShellyScheduleClient } from '@lcl/shelly-client';
import { createShellyTransport } from '../../../platform/shellyHttpTransport.js';

export type TimeAutomationClients = {
  device: Pick<RpcShellyClient, 'getStatus' | 'setRelayOn' | 'setRelayOff'>;
  schedules: Pick<RpcShellyScheduleClient, 'list' | 'create' | 'update' | 'delete'>;
};

export const createTimeAutomationClients = (baseUrl: string): TimeAutomationClients => {
  const transport = createShellyTransport(baseUrl);
  return {
    device: new RpcShellyClient(transport),
    schedules: new RpcShellyScheduleClient(transport)
  };
};
