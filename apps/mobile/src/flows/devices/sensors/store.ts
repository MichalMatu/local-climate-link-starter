import type { AutomationRule } from '../../rules/model.js';
import { canRemoveDevice } from '../../rules/selectors.js';
import type { RegistryRepository } from '../../registry/repository.js';
import type { RegistryResult } from '../../registry/result.js';
import { createRegistryStore } from '../../registry/store.js';
import { savedSensorSchema, type SavedSensor } from './model.js';

export const createSensorStore = (
  repository: RegistryRepository<SavedSensor>,
  readRules: () => RegistryResult<readonly AutomationRule[]>
) =>
  createRegistryStore({
    repository,
    schema: savedSensorSchema,
    beforeUpsert: () => ({ ok: true, value: null }),
    beforeRemove: (id) => {
      const rules = readRules();
      return rules.ok ? canRemoveDevice('sensor', id, rules.value) : rules;
    }
  });
