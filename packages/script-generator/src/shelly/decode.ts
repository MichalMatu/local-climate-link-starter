import type {
  AutomationMode,
  RuleControlMetric,
  ThresholdDirection
} from '@lcl/automation-core';
import type { SensorProfileId } from '@lcl/device-profiles';
import { z } from 'zod';

export type DecodedShellyThermostatRuntimeMode =
  'xiaomi-bthome-minimal' | 'tp357-minimal';

export interface DecodedShellyThermostatSettings {
  version: number;
  sensorProfileId: SensorProfileId;
  sensorDisplayName: string;
  runtimeAddress: string;
  compactAddress: string;
  relayId: number;
  mode: AutomationMode;
  control: {
    metric: RuleControlMetric;
    direction: ThresholdDirection;
    onThreshold: number;
    offThreshold: number;
  };
  vpdAssist: {
    enabled: boolean;
    targetKpa: number | null;
  };
  staleTimeoutSec: number;
  minChangeMs: number;
  maxOnMs: number;
  rssiMin: number;
  consecutiveHits: number;
  failSafe: 'off';
  bootState: 'off';
}

export interface DecodedShellyThermostatScript {
  generatorVersion: string | null;
  runtimeMode: DecodedShellyThermostatRuntimeMode;
  configHash: string | null;
  runtimeConfig: DecodedShellyRuntimeConfig;
  settings: DecodedShellyThermostatSettings;
}

const runtimeModeSchema = z.enum(['xiaomi-bthome-minimal', 'tp357-minimal']);

const runtimeConfigSchema = z.object({
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
  vp: z.number().min(0).max(5)
});

export type DecodedShellyRuntimeConfig = z.infer<typeof runtimeConfigSchema>;

const metadataLine = (script: string, label: string): string | null => {
  const match = new RegExp(`^// ${label}: (.+)$`, 'm').exec(script);
  return match ? match[1]!.trim() : null;
};

const parseRuntimeConfig = (script: string): unknown | null => {
  const start = script.indexOf('var C=');
  if (start < 0) {
    return null;
  }
  const configStart = start + 'var C='.length;
  const end = script.indexOf(';var R=', configStart);
  if (end < 0) {
    return null;
  }

  try {
    return JSON.parse(script.slice(configStart, end)) as unknown;
  } catch {
    return null;
  }
};

const sensorProfileForRuntimeMode = (
  runtimeMode: DecodedShellyThermostatRuntimeMode
): SensorProfileId =>
  runtimeMode === 'tp357-minimal' ? 'tp357_custom_v1' : 'xiaomi_lywsd03mmc_bthome_v2';

const controlMetricForFlag = (metricFlag: 0 | 1): RuleControlMetric =>
  metricFlag === 1 ? 'humidity' : 'temperature';

const thresholdDirectionForFlag = (directionFlag: 0 | 1): ThresholdDirection =>
  directionFlag === 1 ? 'above' : 'below';

const modeForControl = (
  metric: RuleControlMetric,
  direction: ThresholdDirection
): AutomationMode => {
  if (metric === 'humidity') {
    return direction === 'above' ? 'dehumidifying' : 'humidifying';
  }
  return direction === 'above' ? 'cooling' : 'heating';
};

export const decodeShellyThermostatScript = (
  script: string
): DecodedShellyThermostatScript | null => {
  const runtimeModeResult = runtimeModeSchema.safeParse(metadataLine(script, 'm'));
  if (!runtimeModeResult.success) {
    return null;
  }

  const runtimeConfigResult = runtimeConfigSchema.safeParse(parseRuntimeConfig(script));
  if (!runtimeConfigResult.success) {
    return null;
  }

  const runtimeMode = runtimeModeResult.data;
  const runtimeConfig = runtimeConfigResult.data;
  const metric = controlMetricForFlag(runtimeConfig.m);
  const direction = thresholdDirectionForFlag(runtimeConfig.d);

  return {
    generatorVersion: metadataLine(script, 'g'),
    runtimeMode,
    configHash: metadataLine(script, 'h'),
    runtimeConfig,
    settings: {
      version: runtimeConfig.v,
      sensorProfileId: sensorProfileForRuntimeMode(runtimeMode),
      sensorDisplayName: runtimeConfig.n,
      runtimeAddress: runtimeConfig.fa,
      compactAddress: runtimeConfig.a,
      relayId: runtimeConfig.i,
      mode: modeForControl(metric, direction),
      control: {
        metric,
        direction,
        onThreshold: runtimeConfig.on,
        offThreshold: runtimeConfig.off
      },
      vpdAssist: {
        enabled: runtimeConfig.vp > 0,
        targetKpa: runtimeConfig.vp > 0 ? runtimeConfig.vp : null
      },
      staleTimeoutSec: Math.trunc(runtimeConfig.s / 1000),
      minChangeMs: runtimeConfig.c,
      maxOnMs: runtimeConfig.x,
      rssiMin: runtimeConfig.r,
      consecutiveHits: runtimeConfig.h,
      failSafe: 'off',
      bootState: 'off'
    }
  };
};
