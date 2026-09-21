import { z } from 'zod';
import type { ShellyThermostatConfig } from './config.js';

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

const runtimeConfigJsonFromScript = (script: string): unknown | null => {
  const start = script.indexOf('var C=');
  if (start < 0) return null;

  const configStart = start + 'var C='.length;
  const end = script.indexOf(';var R=', configStart);
  if (end < 0) return null;

  try {
    return JSON.parse(script.slice(configStart, end)) as unknown;
  } catch {
    return null;
  }
};

export const decodeShellyRuntimeConfig = (script: string): ShellyRuntimeConfig | null => {
  const result = shellyRuntimeConfigSchema.safeParse(runtimeConfigJsonFromScript(script));
  return result.success ? result.data : null;
};
