import type { RegistryRepository } from '../registry/repository.js';
import type { RegistryResult } from '../registry/result.js';
import { createRegistryStore } from '../registry/store.js';
import { automationRuleSchema, type AutomationRule } from './model.js';
import { resolveRuleDevices, type DeviceRegistries } from './selectors.js';

export const createRuleStore = (
  repository: RegistryRepository<AutomationRule>,
  readDevices: () => RegistryResult<DeviceRegistries>
) =>
  createRegistryStore({
    repository,
    schema: automationRuleSchema,
    beforeUpsert: (rule, existing) => {
      if (
        existing?.deployment &&
        (existing.kind !== rule.kind ||
          existing.plugId !== rule.plugId ||
          existing.relayId !== rule.relayId ||
          (existing.kind === 'climate' &&
            rule.kind === 'climate' &&
            existing.sensorId !== rule.sensorId))
      ) {
        return { ok: false, error: { kind: 'deployment-attached', ruleId: rule.id } };
      }
      const devices = readDevices();
      if (!devices.ok) return devices;
      const resolved = resolveRuleDevices(rule, devices.value);
      return resolved.ok ? { ok: true, value: null } : resolved;
    },
    beforeRemove: (id, rules) =>
      rules.some((rule) => rule.id === id && rule.deployment !== null)
        ? { ok: false, error: { kind: 'deployment-attached', ruleId: id } }
        : { ok: true, value: null }
  });
