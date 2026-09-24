import {
  SHELLY_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  type FetchShellyRpcTransport,
  RpcShellyClient,
  createBleDiscoveryInstallPlan,
  readShellyScriptList as readShellyScriptListResult,
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
import {
  shellyInvalidResponseMessage,
  shellyResultErrorMessage as resultErrorMessage,
  unwrapShellyResult
} from '../../platform/shellyResult.js';

const shellyOutOfMemoryMessage = (): string => t('hardware.shelly.outOfMemory');

export const SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS = 3000;
const BLE_DISCOVERY_ENDPOINT_TIMEOUT_MS = 5000;

export type ShellySetupScanResult = {
  baseUrl: string;
  deviceInfo: HardwareSetupStatus['deviceInfo'];
};

export type ShellyBleDiscoveryPreparation = {
  automationScriptId: number | null;
  automationWasRunning: boolean;
};

export type ShellyRuntimeStatus = {
  relayOn: boolean;
  telemetry: HardwareSetupStatus['status']['telemetry'];
  clock: HardwareSetupStatus['status']['clock'];
};

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

const findAutomationScript = (scripts: ScriptListEntry[]): ScriptListEntry | null => {
  const enabledScripts = scripts.filter((script) => script.enable);
  return enabledScripts.length === 1 ? enabledScripts[0]! : null;
};

const findBleDiscoveryScripts = (scripts: ScriptListEntry[]): ScriptListEntry[] =>
  scripts.filter((script) => script.name === SHELLY_LINK_BLE_DISCOVERY_SCRIPT_NAME);

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

export const cleanupStaleShellyBleDiscoveryScripts = async (
  baseUrl: string
): Promise<number> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const scripts = await readScriptList(transport);
  return deleteBleDiscoveryScripts(client, scripts);
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
