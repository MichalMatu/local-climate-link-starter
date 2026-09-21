import {
  configHash,
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  supportsShellyRuntimeConfigPersistence,
  type DecodedShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import {
  hashScriptCode,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  normalizeShellyDeviceId
} from '@lcl/shelly-client';
import {
  createInstalledAutomation,
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
  'none' | 'recovered' | 'verified' | 'changed' | 'unavailable' | 'conflict';

export type InstalledAutomationReconciliationResult = {
  status: InstalledAutomationReconciliationStatus;
  installationIds: string[];
};

type ClimateRuntimeEvidence = {
  scriptId: number | null;
  scriptName: string | null;
  running: boolean;
  code: string | null;
  persistedRuntimeConfigJson: string | null;
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
      scriptName: state.script?.name ?? null,
      running: state.script?.running === true,
      code: state.code,
      persistedRuntimeConfigJson: state.persistedRuntimeConfigJson
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
    evidence.scriptName !== LOCAL_CLIMATE_LINK_SCRIPT_NAME ||
    !evidence.running ||
    evidence.code === null ||
    hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${evidence.code}`) !==
      installation.script.hash
  ) {
    return false;
  }

  if (!supportsShellyRuntimeConfigPersistence(evidence.code)) return true;
  const decoded = decodeShellyThermostatScript(
    evidence.code,
    evidence.persistedRuntimeConfigJson
  );
  return decoded?.runtimeConfig.k === configHash(installation.config);
};

const runtimeMatches = async (
  installation: InstalledAutomation,
  services: InstalledAutomationReconciliationServices
): Promise<boolean> =>
  installation.kind === 'climate'
    ? climateRuntimeMatches(installation, services)
    : (await services.readTimeScheduleState(installation)) !== 'attention';

const decodeRecoverableClimateRuntime = (
  evidence: ClimateRuntimeEvidence
): DecodedShellyThermostatScript | null => {
  if (
    evidence.scriptId === null ||
    evidence.scriptName !== LOCAL_CLIMATE_LINK_SCRIPT_NAME ||
    evidence.code === null ||
    !evidence.code.startsWith('// LCL')
  ) {
    return null;
  }

  const decoded = decodeShellyThermostatScript(
    evidence.code,
    evidence.persistedRuntimeConfigJson
  );
  if (
    !decoded ||
    decoded.generatorVersion === null ||
    !/^\d+\.\d+\.\d+$/.test(decoded.generatorVersion) ||
    decoded.configHash === null ||
    !/^lcl-[0-9a-f]{8}$/.test(decoded.configHash) ||
    decoded.runtimeConfig.k !== decoded.configHash ||
    decoded.settings.version !== 1
  ) {
    return null;
  }
  return decoded;
};

const recoveredClimateConfig = (
  decoded: DecodedShellyThermostatScript
): ShellyThermostatConfig => {
  const settings = decoded.settings;
  const defaults = createDefaultShellyThermostatConfig(
    settings.sensorProfileId,
    settings.mode
  );

  return {
    ...defaults,
    sensor: {
      ...defaults.sensor,
      sensorId: settings.runtimeAddress,
      runtimeAddress: settings.runtimeAddress,
      displayName: settings.sensorDisplayName,
      parserValidated: true
    },
    output: {
      ...defaults.output,
      relayId: settings.relayId
    },
    rule: {
      ...defaults.rule,
      mode: settings.mode,
      control: { ...settings.control },
      vpdAssist: {
        enabled: settings.vpdAssist.enabled,
        targetKpa: settings.vpdAssist.targetKpa ?? defaults.rule.vpdAssist.targetKpa
      },
      staleTimeoutSec: settings.staleTimeoutSec,
      minChangeMs: settings.minChangeMs,
      maxOnMs: settings.maxOnMs,
      rssiMin: settings.rssiMin,
      consecutiveHits: settings.consecutiveHits,
      failSafe: settings.failSafe,
      bootState: settings.bootState
    }
  };
};

const recoverClimateInstallation = async (
  target: {
    deviceId: string;
    name: string;
    baseUrl: string;
    model: string;
    gen: number;
  },
  services: InstalledAutomationReconciliationServices
): Promise<ClimateInstalledAutomation | null> => {
  const evidence = await services.readClimateRuntime(target.baseUrl);
  const decoded = decodeRecoverableClimateRuntime(evidence);
  if (!decoded || evidence.scriptId === null || evidence.code === null) return null;

  return createInstalledAutomation({
    shelly: { id: target.deviceId, model: target.model, gen: target.gen },
    shellyName: target.name,
    baseUrl: target.baseUrl,
    scriptId: evidence.scriptId,
    scriptHash: hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${evidence.code}`),
    config: recoveredClimateConfig(decoded)
  });
};

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
    try {
      const recovered = await recoverClimateInstallation(target, services);
      if (!recovered) return { status: 'none', installationIds: [] };
      useInstalledAutomationStore.getState().upsertInstallation(recovered);
      return { status: 'recovered', installationIds: [recovered.id] };
    } catch {
      return { status: 'unavailable', installationIds: [] };
    }
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
