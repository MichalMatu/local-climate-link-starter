import { createPlugRepository } from '../devices/plugs/repository.js';
import { createPlugStore } from '../devices/plugs/store.js';
import { createSensorRepository } from '../devices/sensors/repository.js';
import { createSensorStore } from '../devices/sensors/store.js';
import { createRuleRepository } from '../rules/repository.js';
import { createRuleStore } from '../rules/store.js';
import type { AutomationRule } from '../rules/model.js';
import type { DeviceRegistries } from '../rules/selectors.js';
import type { RegistryStorage } from './repository.js';
import type { RegistryResult } from './result.js';

export const createDeviceRuleRegistries = (storage?: RegistryStorage | null) => {
  const readRules = (): RegistryResult<readonly AutomationRule[]> => {
    const state = rules.getState();
    return state.loadError
      ? { ok: false, error: state.loadError }
      : { ok: true, value: state.items };
  };
  const plugs = createPlugStore(createPlugRepository(storage), readRules);
  const sensors = createSensorStore(createSensorRepository(storage), readRules);
  const readDevices = (): RegistryResult<DeviceRegistries> => {
    const error = plugs.getState().loadError ?? sensors.getState().loadError;
    return error
      ? { ok: false, error }
      : {
          ok: true,
          value: { plugs: plugs.getState().items, sensors: sensors.getState().items }
        };
  };
  const rules = createRuleStore(createRuleRepository(storage), readDevices);
  return { plugs, sensors, rules };
};

const registries = createDeviceRuleRegistries();
export const usePlugStore = registries.plugs;
export const useSensorStore = registries.sensors;
export const useRuleStore = registries.rules;
