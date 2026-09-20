import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RpcShellyClient,
  readShellyScriptCode,
  readShellyScriptList,
  type FetchShellyRpcTransport,
  type ShellyDeviceInfo,
  type ShellyScriptListEntry,
  type ShellyStatus
} from '@lcl/shelly-client';
import { createShellyTransport } from '../../../platform/shellyHttpTransport.js';
import { unwrapShellyResult } from '../../../platform/shellyResult.js';

export type ShellyAutomationMode = 'auto' | 'manual' | 'missing';

export type ShellyControlStatus = {
  relayOn: boolean;
  automationMode: ShellyAutomationMode;
  automationScriptId: number | null;
  firmwareId: string | null;
  telemetry: ShellyStatus['telemetry'];
  clock: ShellyStatus['clock'];
};

export type ShellyAutomationScriptState = {
  script: ShellyScriptListEntry | null;
  code: string | null;
  status: ShellyControlStatus;
};

const readScriptList = async (
  transport: FetchShellyRpcTransport
): Promise<ShellyScriptListEntry[]> =>
  unwrapShellyResult(await readShellyScriptList(transport));

const findAutomationScript = (
  scripts: ShellyScriptListEntry[]
): ShellyScriptListEntry | null =>
  scripts.find((script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME) ?? null;

const toControlStatus = (
  deviceInfo: ShellyDeviceInfo,
  status: ShellyStatus,
  scripts: ShellyScriptListEntry[]
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
): Promise<string> => unwrapShellyResult(await readShellyScriptCode(transport, scriptId));

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
