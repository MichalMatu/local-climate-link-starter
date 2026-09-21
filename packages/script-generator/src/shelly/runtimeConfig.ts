import { z } from 'zod';
import type { ShellyThermostatConfig } from './config.js';
import { configHash, stableStringify } from './hash.js';

export const SHELLY_RUNTIME_CONFIG_STORAGE_KEY = 'c';

export const shellyRuntimeConfigSchema = z.object({
  a: z.string().min(1),
  fa: z.string().min(1),
  n: z.string().min(1),
  k: z.string().min(1),
  i: z.number().int().min(0),
  r: z.number().int().min(-100).max(-20),
  on: z.number(),
  off: z.number(),
  d: z.union([z.literal(0), z.literal(1)]),
  m: z.union([z.literal(0), z.literal(1)]),
  h: z.number().int().min(1).max(10),
  c: z.number().int().positive(),
  s: z.number().int().positive(),
  x: z.number().int().positive(),
  v: z.number().int().positive(),
  vp: z.number().min(0).max(5),
  p: z.union([z.literal(0), z.literal(1)]).optional()
});

export type ShellyRuntimeConfig = z.infer<typeof shellyRuntimeConfigSchema>;

const compactAddress = (address: string): string =>
  address.replace(/[:-]/g, '').toUpperCase();

export const createShellyRuntimeConfig = (
  config: ShellyThermostatConfig,
  hash: string
): ShellyRuntimeConfig => ({
  a: compactAddress(config.sensor.runtimeAddress),
  fa: config.sensor.runtimeAddress,
  n: config.sensor.displayName,
  k: hash,
  i: config.output.relayId,
  r: config.rule.rssiMin,
  on: config.rule.control.onThreshold,
  off: config.rule.control.offThreshold,
  d: config.rule.control.direction === 'above' ? 1 : 0,
  m: config.rule.control.metric === 'humidity' ? 1 : 0,
  h: config.rule.consecutiveHits,
  c: config.rule.minChangeMs,
  s: config.rule.staleTimeoutSec * 1000,
  x: config.rule.maxOnMs,
  v: config.version,
  vp: config.rule.vpdAssist.enabled ? config.rule.vpdAssist.targetKpa : 0,
  p: config.sensor.profileId === 'tp357_custom_v1' ? 1 : 0
});

export const serializeShellyRuntimeConfig = (config: ShellyThermostatConfig): string =>
  stableStringify(createShellyRuntimeConfig(config, configHash(config)));

export const shellyRuntimeConfigMatchesConfig = (
  runtimeConfig: ShellyRuntimeConfig,
  config: ShellyThermostatConfig
): boolean =>
  stableStringify(runtimeConfig) ===
  stableStringify(createShellyRuntimeConfig(config, runtimeConfig.k));

export const parseShellyRuntimeConfig = (input: unknown): ShellyRuntimeConfig | null => {
  const result = shellyRuntimeConfigSchema.safeParse(input);
  return result.success ? result.data : null;
};

export const decodeShellyRuntimeConfigJson = (value: string): ShellyRuntimeConfig | null => {
  try {
    return parseShellyRuntimeConfig(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
};

export const supportsShellyRuntimeConfigPersistence = (script: string): boolean =>
  script.includes('// m: climate-engine-v1') &&
  script.includes('function vc(c)') &&
  script.includes(`Script.storage.getItem("${SHELLY_RUNTIME_CONFIG_STORAGE_KEY}")`);

const runtimeConfigJsonFromScript = (script: string): unknown | null => {
  const marker = 'var C=';
  const markerStart = script.indexOf(marker);
  if (markerStart < 0) return null;

  const configStart = markerStart + marker.length;
  if (script[configStart] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = configStart; index < script.length; index += 1) {
    const character = script[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(script.slice(configStart, index + 1)) as unknown;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
};

export const decodeShellyRuntimeConfig = (script: string): ShellyRuntimeConfig | null =>
  parseShellyRuntimeConfig(runtimeConfigJsonFromScript(script));
