import {
  shellyThermostatConfigSchema,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import type { ShellyDeviceInfo } from '@lcl/shelly-client';
import { z } from 'zod';

export const INSTALLED_AUTOMATION_VERSION = 1 as const;

const installedShellySchema = z.object({
  deviceId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  baseUrl: z.string().url(),
  model: z.string().trim().min(1),
  gen: z.number().int().positive()
});

const installedScriptSchema = z.object({
  id: z.number().int().nonnegative(),
  hash: z.string().trim().min(1)
});

export const installedAutomationSchema = z.object({
  version: z.literal(INSTALLED_AUTOMATION_VERSION),
  id: z.string().trim().min(1),
  kind: z.literal('climate'),
  shelly: installedShellySchema,
  script: installedScriptSchema,
  config: shellyThermostatConfigSchema,
  installedAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative()
});

export type InstalledAutomation = z.infer<typeof installedAutomationSchema>;

export const createInstalledAutomationId = (
  shellyDeviceId: string,
  relayId: number
): string => `climate:${shellyDeviceId.trim().toLowerCase()}:${relayId}`;

export const createInstalledAutomation = ({
  shelly,
  shellyName,
  baseUrl,
  scriptId,
  scriptHash,
  config,
  nowMs = Date.now()
}: {
  shelly: ShellyDeviceInfo;
  shellyName: string;
  baseUrl: string;
  scriptId: number;
  scriptHash: string;
  config: ShellyThermostatConfig;
  nowMs?: number;
}): InstalledAutomation => {
  const deviceId = shelly.id?.trim();
  if (!deviceId) {
    throw new Error('Shelly did not expose a stable device id.');
  }

  return installedAutomationSchema.parse({
    version: INSTALLED_AUTOMATION_VERSION,
    id: createInstalledAutomationId(deviceId, config.output.relayId),
    kind: 'climate',
    shelly: {
      deviceId,
      name: shellyName,
      baseUrl,
      model: shelly.model,
      gen: shelly.gen
    },
    script: {
      id: scriptId,
      hash: scriptHash
    },
    config,
    installedAtMs: nowMs,
    updatedAtMs: nowMs
  });
};
