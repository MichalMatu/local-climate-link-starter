import {
  shellyThermostatConfigSchema,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import type { SavedPlug } from '../devices/plugs/model.js';
import type { SavedSensor } from '../devices/sensors/model.js';
import type { RegistryResult } from '../registry/result.js';
import type { AutomationRule, ClimateRule } from './model.js';

export type DeviceRegistries = {
  plugs: readonly SavedPlug[];
  sensors: readonly SavedSensor[];
};
export type ResolvedRule =
  | { rule: ClimateRule; plug: SavedPlug; sensor: SavedSensor }
  | { rule: Extract<AutomationRule, { kind: 'time' }>; plug: SavedPlug };

export const resolveRuleDevices = (
  rule: AutomationRule,
  devices: DeviceRegistries
): RegistryResult<ResolvedRule> => {
  const plug = devices.plugs.find((candidate) => candidate.id === rule.plugId);
  if (!plug)
    return {
      ok: false,
      error: { kind: 'device-missing', deviceKind: 'plug', deviceId: rule.plugId }
    };
  if (rule.kind === 'time') return { ok: true, value: { rule, plug } };
  const sensor = devices.sensors.find((candidate) => candidate.id === rule.sensorId);
  return sensor
    ? { ok: true, value: { rule, plug, sensor } }
    : {
        ok: false,
        error: { kind: 'device-missing', deviceKind: 'sensor', deviceId: rule.sensorId }
      };
};

export const deviceReferencingRuleIds = (
  kind: 'plug' | 'sensor',
  id: string,
  rules: readonly AutomationRule[]
): string[] =>
  rules
    .filter((rule) =>
      kind === 'plug'
        ? rule.plugId === id
        : rule.kind === 'climate' && rule.sensorId === id
    )
    .map((rule) => rule.id);

export const canRemoveDevice = (
  kind: 'plug' | 'sensor',
  id: string,
  rules: readonly AutomationRule[]
): RegistryResult<null> => {
  const ruleIds = deviceReferencingRuleIds(kind, id, rules);
  return ruleIds.length
    ? { ok: false, error: { kind: 'device-referenced', ruleIds } }
    : { ok: true, value: null };
};

export const resolveClimateGeneratorConfig = (
  rule: ClimateRule,
  devices: DeviceRegistries
): RegistryResult<ShellyThermostatConfig> => {
  const resolved = resolveRuleDevices(rule, devices);
  if (!resolved.ok) return resolved;
  if (!('sensor' in resolved.value)) throw new Error('Expected a climate rule.');
  const { plug, sensor } = resolved.value;
  const parsed = shellyThermostatConfigSchema.safeParse({
    version: 1,
    ...rule.config,
    sensor: {
      profileId: sensor.profileId,
      sensorId: sensor.id,
      runtimeAddress: sensor.runtimeAddress,
      displayName: sensor.name,
      parserValidated: true
    },
    output: { profileId: plug.profileId, relayId: rule.relayId }
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: { kind: 'validation-failed' } };
};
