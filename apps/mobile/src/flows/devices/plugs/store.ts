import type { AutomationRule } from '../../rules/model.js';
import { canRemoveDevice } from '../../rules/selectors.js';
import type { RegistryRepository } from '../../registry/repository.js';
import type { RegistryResult } from '../../registry/result.js';
import { createRegistryStore } from '../../registry/store.js';
import { savedPlugSchema, type SavedPlug } from './model.js';

export const createPlugStore = (
  repository: RegistryRepository<SavedPlug>,
  readRules: () => RegistryResult<readonly AutomationRule[]>
) =>
  createRegistryStore({
    repository,
    schema: savedPlugSchema,
    beforeUpsert: () => ({ ok: true, value: null }),
    beforeRemove: (id) => {
      const rules = readRules();
      return rules.ok ? canRemoveDevice('plug', id, rules.value) : rules;
    }
  });
