import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { savedPlugSchema } from '../devices/plugs/model.js';
import { createSensorId, savedSensorSchema } from '../devices/sensors/model.js';
import { climateRuleSchema, timeRuleSchema } from '../rules/model.js';
import type { RegistryStorage } from './repository.js';

export const plug = savedPlugSchema.parse({
  version: 1,
  id: 'SHELLY-ABC',
  profileId: 'shelly_plug_s_gen3',
  name: 'Desk',
  baseUrl: 'http://192.168.0.20',
  model: 'S3PL-00112EU',
  gen: 3,
  createdAtMs: 1,
  updatedAtMs: 1
});
export const sensor = savedSensorSchema.parse({
  version: 1,
  id: createSensorId('xiaomi_lywsd03mmc_bthome_v2', 'AA:BB:CC:DD:EE:FF'),
  profileId: 'xiaomi_lywsd03mmc_bthome_v2',
  name: 'Room',
  runtimeAddress: 'AA:BB:CC:DD:EE:FF',
  createdAtMs: 1,
  updatedAtMs: 1
});
const config = createDefaultShellyThermostatConfig();
export const climate = climateRuleSchema.parse({
  version: 1,
  id: 'climate-1',
  kind: 'climate',
  name: 'Heating',
  plugId: plug.id,
  relayId: 0,
  sensorId: sensor.id,
  config: { rule: config.rule, diagnostics: config.diagnostics },
  deployment: null,
  createdAtMs: 2,
  updatedAtMs: 2
});
export const time = timeRuleSchema.parse({
  version: 1,
  id: 'time-1',
  kind: 'time',
  name: 'Morning',
  plugId: plug.id,
  relayId: 0,
  config: { onTime: '08:00', offTime: '20:00' },
  deployment: null,
  createdAtMs: 2,
  updatedAtMs: 2
});
export const memoryStorage = (): RegistryStorage => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    }
  };
};
