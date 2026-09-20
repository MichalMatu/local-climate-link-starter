import {
  LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  type FetchShellyRpcTransport,
  RpcShellyClient,
  createBleDiscoveryInstallPlan,
  readShellyScriptCode as readShellyScriptCodeResult,
  readShellyScriptList as readShellyScriptListResult,
  type Result,
  type ShellyClientError,
  type ShellyDeviceInfo,
  type ShellyInstallResult
} from '@lcl/shelly-client';
import {
  bleDiscoverySnapshotSchema,
  type BleDiscoverySnapshot,
  type HardwareSetupStatus,
  type ScriptListEntry
} from './schemas.js';
import { t } from '../../app/i18n.js';
import {
  createShellyFetch,
  createShellyTransport
} from '../../platform/shellyHttpTransport.js';

const shellyInvalidResponseMessage = (): string => t('hardware.shelly.invalidResponse');
const shellyOutOfMemoryMessage = (): string => t('hardware.shelly.outOfMemory');
const shellyScriptsMissingMessage = (): string => t('hardware.shelly.scriptsMissing');
const shellyScriptsDisabledMessage = (): string => t('hardware.shelly.scriptsDisabled');
const shellyBleMissingMessage = (): string => t('hardware.shelly.bleMissing');
const shellyBleDisabledMessage = (): string => t('hardware.shelly.bleDisabled');

export const SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS = 3000;
const BLE_DISCOVERY_ENDPOINT_TIMEOUT_MS = 5000;

const resultErrorMessage = (result: Result<unknown, ShellyClientError>): string =>
  result.ok
    ? 'OK'
    : result.error.kind === 'matter-enabled'
      ? t('hardware.safety.matterBlocked')
      : result.error.userMessageKey === 'errors.shellyInvalidResponse' ||
          result.error.technicalMessage?.startsWith('Shelly RPC HTTP ')
        ? shellyInvalidResponseMessage()
        : result.error.technicalMessage?.includes('Scripts component') ||
            result.error.technicalMessage?.includes('Script.List')
          ? shellyScriptsMissingMessage()
          : result.error.technicalMessage?.includes('Scripts are disabled')
            ? shellyScriptsDisabledMessage()
            : result.error.technicalMessage?.includes('BLE component')
              ? shellyBleMissingMessage()
              : result.error.technicalMessage?.includes('BLE is disabled')
                ? shellyBleDisabledMessage()
                : (result.error.technicalMessage ?? `Shelly RPC: ${result.error.kind}`);

export const unwrapShellyResult = <T>(result: Result<T, ShellyClientError>): T => {
  if (!result.ok) {
    throw new Error(resultErrorMessage(result));
  }
  return result.value;
};

export type ShellySetupScanResult = {
  baseUrl: string;
  deviceInfo: HardwareSetupStatus['deviceInfo'];
};

export type ShellyBleDiscoveryPreparation = {
  automationScriptId: number | null;
  automationWasRunning: boolean;
};

export type ShellyAutomationMode = 'auto' | 'manual' | 'missing';

export type ShellyControlStatus = {
  relayOn: boolean;
  automationMode: ShellyAutomationMode;
  automationScriptId: number | null;
  firmwareId: string | null;
  telemetry: HardwareSetupStatus['status']['telemetry'];
  clock: HardwareSetupStatus['status']['clock'];
};

export type ShellyRuntimeStatus = Pick<
  ShellyControlStatus,
  'relayOn' | 'telemetry' | 'clock'
>;

export type ShellyAutomationScriptState = {
  script: ScriptListEntry | null;
  code: string | null;
  status: ShellyControlStatus;
};

export class ShellyAutomationDeleteError extends Error {
  constructor(
    message: string,
    readonly relayOffConfirmed: boolean
  ) {
    super(message);
  }
}

export const fetchShellyJson = async (
  targetUrl: URL,
  timeoutMs: number
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await createShellyFetch(timeoutMs)(targetUrl, {
      signal: controller.signal
    });
    const body = await response.text();
    if (body.trim() === 'out_of_memory') {
      throw new Error(shellyOutOfMemoryMessage());
    }
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new Error(shellyInvalidResponseMessage());
    }
  } finally {
    window.clearTimeout(timeout);
  }
};

export const readShellyRuntimeStatus = async (
  baseUrl: string
): Promise<ShellyRuntimeStatus> => {
  const client = new RpcShellyClient(createShellyTransport(baseUrl));
  const status = unwrapShellyResult(await client.getStatus());
  return {
    relayOn: status.relayOn,
    telemetry: status.telemetry,
    clock: status.clock
  };
};

const createShellyScanTransport = (baseUrl: string, signal?: AbortSignal) =>
  createShellyTransport(baseUrl, {
    timeoutMs: SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS,
    ...(signal ? { signal } : {})
  });

const readScriptList = async (
  transport: FetchShellyRpcTransport
): Promise<HardwareSetupStatus['scripts']> =>
  unwrapShellyResult(await readShellyScriptListResult(transport));

const findAutomationScript = (scripts: ScriptListEntry[]): ScriptListEntry | null =>
  scripts.find((script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME) ?? null;

const findBleDiscoveryScripts = (scripts: ScriptListEntry[]): ScriptListEntry[] =>
  scripts.filter(
    (script) => script.name === LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME
  );

const deleteBleDiscoveryScripts = async (
  client: RpcShellyClient,
  scripts: ScriptListEntry[]
): Promise<number> => {
  const discoveryScripts = findBleDiscoveryScripts(scripts);
  const cleanupErrors: string[] = [];
  let deletedCount = 0;

  for (const script of discoveryScripts) {
    let stopError: string | null = null;
    if (script.running) {
      const stopResult = await client.stopScript(script.id);
      if (!stopResult.ok) {
        stopError = t('hardware.shelly.stopBleScannerDetail', {
          id: script.id,
          error: resultErrorMessage(stopResult)
        });
      }
    }

    const deleteResult = await client.deleteScript(script.id);
    if (!deleteResult.ok) {
      cleanupErrors.push(
        [
          stopError,
          t('hardware.shelly.deleteBleScannerDetail', {
            id: script.id,
            error: resultErrorMessage(deleteResult)
          })
        ]
          .filter(Boolean)
          .join(' ')
      );
      continue;
    }

    deletedCount += 1;
  }

  if (cleanupErrors.length > 0) {
    throw new Error(
      [t('hardware.shelly.bleScannerCleanupFailed'), ...cleanupErrors].join(' ')
    );
  }

  return deletedCount;
};

const toControlStatus = (
  deviceInfo: ShellyDeviceInfo,
  status: HardwareSetupStatus['status'],
  scripts: ScriptListEntry[]
): ShellyControlStatus => {
  const automationScript = findAutomationScript(scripts);
  return {
    relayOn: status.relayOn,
    automationMode: automationScript
      ? automationScript.running
        ? 'auto'
        : 'manual'
      : 'missing',
    automationScriptId: automationScript?.id ?? null,
    firmwareId: deviceInfo.firmwareId ?? null,
    telemetry: status.telemetry,
    clock: status.clock
  };
};

const readScriptCode = async (
  transport: FetchShellyRpcTransport,
  scriptId: number
): Promise<string> =>
  unwrapShellyResult(await readShellyScriptCodeResult(transport, scriptId));

export const readShellySetupStatus = async (
  baseUrl: string
): Promise<HardwareSetupStatus> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const [deviceInfo, status, scripts] = await Promise.all([
    client.getDeviceInfo(),
    client.getStatus(),
    readScriptList(transport)
  ]);
  const parsedDeviceInfo = unwrapShellyResult(deviceInfo);
  const parsedStatus = unwrapShellyResult(status);
  const statusWithDeviceInfo =
    parsedDeviceInfo.matterEnabled === true
      ? { ...parsedStatus, matterEnabled: true }
      : parsedStatus;

  return {
    deviceInfo: parsedDeviceInfo,
    status:
      statusWithDeviceInfo.scripts === 'missing'
        ? { ...statusWithDeviceInfo, scripts: 'enabled' }
        : statusWithDeviceInfo,
    scripts
  };
};

export const readShellySetupScanResult = async (
  baseUrl: string,
  signal?: AbortSignal
): Promise<ShellySetupScanResult> => {
  const transport = createShellyScanTransport(baseUrl, signal);
  const client = new RpcShellyClient(transport);
  const deviceInfo = unwrapShellyResult(await client.getDeviceInfo());

  return {
    baseUrl,
    deviceInfo
  };
};

export const prepareShellyBleDiscovery = async (
  baseUrl: string
): Promise<ShellyBleDiscoveryPreparation> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  unwrapShellyResult(await client.setRelayOff());

  const scripts = await readScriptList(transport);
  await deleteBleDiscoveryScripts(client, scripts);
  const automationScript = findAutomationScript(scripts);
  if (automationScript?.running) {
    unwrapShellyResult(await client.stopScript(automationScript.id));
  }

  return {
    automationScriptId: automationScript?.id ?? null,
    automationWasRunning: automationScript?.running ?? false
  };
};

export const readShellyControlStatus = async (
  baseUrl: string
): Promise<ShellyControlStatus> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const [deviceInfo, status, scripts] = await Promise.all([
    client.getDeviceInfo(),
    client.getStatus(),
    readScriptList(transport)
  ]);

  return toControlStatus(
    unwrapShellyResult(deviceInfo),
    unwrapShellyResult(status),
    scripts
  );
};

export const cleanupStaleShellyBleDiscoveryScripts = async (
  baseUrl: string
): Promise<number> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const scripts = await readScriptList(transport);
  return deleteBleDiscoveryScripts(client, scripts);
};

export const readShellyManagedAutomationScriptCode = async (
  baseUrl: string,
  scriptId: number
): Promise<string> => {
  const transport = createShellyTransport(baseUrl);
  const scripts = await readScriptList(transport);
  const script = scripts.find((candidate) => candidate.id === scriptId);

  if (!script || script.name !== LOCAL_CLIMATE_LINK_SCRIPT_NAME) {
    throw new Error('Shelly did not return the exact managed automation script.');
  }

  return readScriptCode(transport, scriptId);
};

export const readShellyAutomationScriptState = async (
  baseUrl: string
): Promise<ShellyAutomationScriptState> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const [deviceInfo, status, scripts] = await Promise.all([
    client.getDeviceInfo(),
    client.getStatus(),
    readScriptList(transport)
  ]);
  const automationScript = findAutomationScript(scripts);

  return {
    script: automationScript,
    code: automationScript ? await readScriptCode(transport, automationScript.id) : null,
    status: toControlStatus(
      unwrapShellyResult(deviceInfo),
      unwrapShellyResult(status),
      scripts
    )
  };
};

export const deleteShellyAutomationScript = async (
  baseUrl: string
): Promise<ShellyControlStatus> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const scripts = await readScriptList(transport);
  const automationScript = findAutomationScript(scripts);

  if (automationScript) {
    try {
      unwrapShellyResult(await client.setRelayOff());
      const status = unwrapShellyResult(await client.getStatus());
      if (status.relayOn) {
        throw new Error(t('hardware.shelly.relayStillOn'));
      }
    } catch (error) {
      throw new ShellyAutomationDeleteError(
        t('hardware.shelly.requireOffBeforeDelete', {
          error: error instanceof Error ? error.message : ''
        }).trim(),
        false
      );
    }

    let stopError: string | null = null;
    if (automationScript.running) {
      const stopResult = await client.stopScript(automationScript.id);
      if (!stopResult.ok) {
        stopError = resultErrorMessage(stopResult);
      }
    }

    const deleteResult = await client.deleteScript(automationScript.id);
    if (!deleteResult.ok) {
      const details = [
        t('hardware.shelly.deleteScriptPartial'),
        stopError
          ? t('hardware.shelly.stopAutomationScriptDetail', { error: stopError })
          : null,
        t('hardware.shelly.deleteAutomationScriptDetail', {
          error: resultErrorMessage(deleteResult)
        })
      ]
        .filter(Boolean)
        .join(' ');
      throw new ShellyAutomationDeleteError(details, true);
    }
  }

  return readShellyControlStatus(baseUrl);
};

export const installShellyBleDiscoveryScript = async (
  baseUrl: string,
  scriptCode: string
): Promise<ShellyInstallResult> => {
  const client = new RpcShellyClient(createShellyTransport(baseUrl));
  const result = await client.installScript(createBleDiscoveryInstallPlan(scriptCode));
  return unwrapShellyResult(result);
};

export const readShellyBleDiscoverySnapshot = async (
  baseUrl: string,
  scriptId: number
): Promise<BleDiscoverySnapshot> => {
  const endpoint = new URL(`/script/${scriptId}/ble-scan`, baseUrl);
  const payload = await fetchShellyJson(endpoint, BLE_DISCOVERY_ENDPOINT_TIMEOUT_MS);
  const parsed = bleDiscoverySnapshotSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  return parsed.data;
};

export const restartShellyBleDiscoveryScan = async (
  baseUrl: string,
  scriptId: number
): Promise<void> => {
  const client = new RpcShellyClient(createShellyTransport(baseUrl));
  unwrapShellyResult(await client.stopScript(scriptId));
  unwrapShellyResult(await client.startScript(scriptId));
};

export const stopShellyBleDiscovery = async (
  baseUrl: string,
  options: {
    discoveryScriptId: number | null;
    automationScriptId: number | null;
    restartAutomation: boolean;
  }
): Promise<void> => {
  const client = new RpcShellyClient(createShellyTransport(baseUrl));
  let stopError: Error | null = null;
  let discoveryStopped = options.discoveryScriptId === null;

  if (options.discoveryScriptId !== null) {
    try {
      unwrapShellyResult(await client.stopScript(options.discoveryScriptId));
      discoveryStopped = true;
      unwrapShellyResult(await client.deleteScript(options.discoveryScriptId));
    } catch (error) {
      stopError =
        error instanceof Error
          ? error
          : new Error(t('hardware.shelly.deleteScannerFailed'));
    }
  }

  if (
    options.restartAutomation &&
    options.automationScriptId !== null &&
    discoveryStopped
  ) {
    unwrapShellyResult(await client.startScript(options.automationScriptId));
  }

  if (stopError) {
    throw stopError;
  }
};
