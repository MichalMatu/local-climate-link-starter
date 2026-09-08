import {
  shellyThermostatConfigSchema,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import type { ShellyDeviceInfo } from '@lcl/shelly-client';
import { z } from 'zod';
import {
  dailyTimeAutomationConfigSchema,
  type DailyTimeAutomationConfig
} from '../time-automation/config.js';

export const INSTALLED_AUTOMATION_VERSION = 1 as const;

const installedShellySchema = z.object({
  deviceId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  baseUrl: z.string().url(),
  model: z.string().trim().min(1),
  gen: z.number().int().positive()
});

const installationBaseSchema = z.object({
  version: z.literal(INSTALLED_AUTOMATION_VERSION),
  id: z.string().trim().min(1),
  shelly: installedShellySchema,
  installedAtMs: z.number().int().nonnegative(),
  updatedAtMs: z.number().int().nonnegative()
});

const installedScriptSchema = z.object({
  id: z.number().int().nonnegative(),
  hash: z.string().trim().min(1)
});

const installedScheduleSchema = z.object({
  onJobId: z.number().int().nonnegative(),
  offJobId: z.number().int().nonnegative()
});

export const climateInstalledAutomationSchema = installationBaseSchema.extend({
  kind: z.literal('climate'),
  script: installedScriptSchema,
  config: shellyThermostatConfigSchema
});

export const timeInstalledAutomationSchema = installationBaseSchema.extend({
  kind: z.literal('time'),
  schedule: installedScheduleSchema,
  config: dailyTimeAutomationConfigSchema
});

export const installedAutomationSchema = z.discriminatedUnion('kind', [
  climateInstalledAutomationSchema,
  timeInstalledAutomationSchema
]);

export type ClimateInstalledAutomation = z.infer<typeof climateInstalledAutomationSchema>;
export type TimeInstalledAutomation = z.infer<typeof timeInstalledAutomationSchema>;
export type InstalledAutomation = z.infer<typeof installedAutomationSchema>;
export type InstalledAutomationKind = InstalledAutomation['kind'];

const normalizedDeviceId = (deviceId: string): string => deviceId.trim().toLowerCase();

export const createInstalledAutomationId = (
  shellyDeviceId: string,
  relayId: number
): string => `climate:${normalizedDeviceId(shellyDeviceId)}:${relayId}`;

export const createTimeInstalledAutomationId = (
  shellyDeviceId: string,
  relayId: number
): string => `time:${normalizedDeviceId(shellyDeviceId)}:${relayId}`;

const stableShellyIdentity = ({
  shelly,
  shellyName,
  baseUrl
}: {
  shelly: ShellyDeviceInfo;
  shellyName: string;
  baseUrl: string;
}) => {
  const deviceId = shelly.id?.trim();
  if (!deviceId) {
    throw new Error('Shelly did not expose a stable device id.');
  }

  return {
    deviceId,
    shelly: {
      deviceId,
      name: shellyName,
      baseUrl,
      model: shelly.model,
      gen: shelly.gen
    }
  };
};

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
}): ClimateInstalledAutomation => {
  const identity = stableShellyIdentity({ shelly, shellyName, baseUrl });

  return climateInstalledAutomationSchema.parse({
    version: INSTALLED_AUTOMATION_VERSION,
    id: createInstalledAutomationId(identity.deviceId, config.output.relayId),
    kind: 'climate',
    shelly: identity.shelly,
    script: {
      id: scriptId,
      hash: scriptHash
    },
    config,
    installedAtMs: nowMs,
    updatedAtMs: nowMs
  });
};

export const createTimeInstalledAutomation = ({
  shelly,
  shellyName,
  baseUrl,
  onJobId,
  offJobId,
  config,
  nowMs = Date.now()
}: {
  shelly: ShellyDeviceInfo;
  shellyName: string;
  baseUrl: string;
  onJobId: number;
  offJobId: number;
  config: DailyTimeAutomationConfig;
  nowMs?: number;
}): TimeInstalledAutomation => {
  const identity = stableShellyIdentity({ shelly, shellyName, baseUrl });

  return timeInstalledAutomationSchema.parse({
    version: INSTALLED_AUTOMATION_VERSION,
    id: createTimeInstalledAutomationId(identity.deviceId, config.relayId),
    kind: 'time',
    shelly: identity.shelly,
    schedule: { onJobId, offJobId },
    config,
    installedAtMs: nowMs,
    updatedAtMs: nowMs
  });
};

export const installedAutomationRelayId = (installation: InstalledAutomation): number =>
  installation.kind === 'climate'
    ? installation.config.output.relayId
    : installation.config.relayId;

export const findInstalledRelayOwner = ({
  installations,
  deviceId,
  relayId,
  ignoreInstallationId
}: {
  installations: readonly InstalledAutomation[];
  deviceId: string;
  relayId: number;
  ignoreInstallationId?: string;
}): InstalledAutomation | null =>
  installations.find(
    (installation) =>
      installation.id !== ignoreInstallationId &&
      normalizedDeviceId(installation.shelly.deviceId) === normalizedDeviceId(deviceId) &&
      installedAutomationRelayId(installation) === relayId
  ) ?? null;

export const findRelayOwnerConflict = ({
  requestedKind,
  ...ownerQuery
}: {
  installations: readonly InstalledAutomation[];
  deviceId: string;
  relayId: number;
  requestedKind: InstalledAutomationKind;
  ignoreInstallationId?: string;
}): InstalledAutomation | null => {
  const owner = findInstalledRelayOwner(ownerQuery);
  return owner && owner.kind !== requestedKind ? owner : null;
};
