import {
  hashScriptCode,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  normalizeShellyDeviceId
} from '@lcl/shelly-client';
import {
  installedAutomationRelayId,
  type ClimateInstalledAutomation,
  type InstalledAutomation,
  type TimeInstalledAutomation
} from '../data/installedAutomation.js';
import { readShellyAutomationScriptState } from '../data/shellyManagedAutomation.js';
import { readTimeAutomationRuntime } from '../data/timeAutomationRuntimeState.js';
import type { TimeAutomationScheduleState } from '../data/timeAutomationSchedule.js';
import { useInstalledAutomationStore } from '../state/installedAutomationStore.js';

export type InstalledAutomationReconciliationStatus =
  'none' | 'verified' | 'changed' | 'unavailable' | 'conflict';

export type InstalledAutomationReconciliationResult = {
  status: InstalledAutomationReconciliationStatus;
  installationIds: string[];
};

type ClimateRuntimeEvidence = {
  scriptId: number | null;
  running: boolean;
  code: string | null;
};

export type InstalledAutomationReconciliationServices = {
  readClimateRuntime(baseUrl: string): Promise<ClimateRuntimeEvidence>;
  readTimeScheduleState(
    installation: TimeInstalledAutomation
  ): Promise<TimeAutomationScheduleState>;
};

const defaultServices: InstalledAutomationReconciliationServices = {
  readClimateRuntime: async (baseUrl) => {
    const state = await readShellyAutomationScriptState(baseUrl);
    return {
      scriptId: state.script?.id ?? null,
      running: state.script?.running === true,
      code: state.code
    };
  },
  readTimeScheduleState: async (installation) =>
    (await readTimeAutomationRuntime(installation)).scheduleState
};

const matchesDevice = (installation: InstalledAutomation, deviceId: string): boolean =>
  normalizeShellyDeviceId(installation.shelly.deviceId) ===
  normalizeShellyDeviceId(deviceId);

const hasRelayOwnershipConflict = (
  installations: readonly InstalledAutomation[]
): boolean => {
  const relayIds = new Set<number>();
  for (const installation of installations) {
    const relayId = installedAutomationRelayId(installation);
    if (relayIds.has(relayId)) return true;
    relayIds.add(relayId);
  }
  return false;
};

const climateRuntimeMatches = async (
  installation: ClimateInstalledAutomation,
  services: InstalledAutomationReconciliationServices
): Promise<boolean> => {
  const evidence = await services.readClimateRuntime(installation.shelly.baseUrl);
  if (
    evidence.scriptId !== installation.script.id ||
    !evidence.running ||
    evidence.code === null
  ) {
    return false;
  }
  return (
    hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${evidence.code}`) ===
    installation.script.hash
  );
};

const runtimeMatches = async (
  installation: InstalledAutomation,
  services: InstalledAutomationReconciliationServices
): Promise<boolean> =>
  installation.kind === 'climate'
    ? climateRuntimeMatches(installation, services)
    : (await services.readTimeScheduleState(installation)) !== 'attention';

export const reconcileInstalledAutomationsForShelly = async (
  target: {
    deviceId: string;
    name: string;
    baseUrl: string;
    model: string;
    gen: number;
  },
  services: InstalledAutomationReconciliationServices = defaultServices
): Promise<InstalledAutomationReconciliationResult> => {
  const matches = useInstalledAutomationStore
    .getState()
    .installations.filter((installation) => matchesDevice(installation, target.deviceId));
  if (matches.length === 0) {
    return { status: 'none', installationIds: [] };
  }

  const reconciled = matches.map((installation): InstalledAutomation => ({
    ...installation,
    shelly: {
      ...installation.shelly,
      name: target.name,
      baseUrl: target.baseUrl,
      model: target.model,
      gen: target.gen
    }
  }));
  const upsertInstallation = useInstalledAutomationStore.getState().upsertInstallation;
  for (const installation of reconciled) upsertInstallation(installation);

  const installationIds = reconciled.map((installation) => installation.id);
  if (hasRelayOwnershipConflict(reconciled)) {
    return { status: 'conflict', installationIds };
  }

  try {
    for (const installation of reconciled) {
      if (!(await runtimeMatches(installation, services))) {
        return { status: 'changed', installationIds };
      }
    }
    return { status: 'verified', installationIds };
  } catch {
    return { status: 'unavailable', installationIds };
  }
};
