import {
  LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  FetchShellyRpcTransport,
  RPC_METHODS,
  RpcShellyClient,
  createBleDiscoveryInstallPlan,
  type Result,
  type ShellyClientError,
  type ShellyInstallResult
} from '@lcl/shelly-client';
import {
  Capacitor,
  CapacitorHttp,
  type HttpHeaders,
  type HttpResponse
} from '@capacitor/core';
import {
  bleDiscoverySnapshotSchema,
  scriptListSchema,
  type BleDiscoverySnapshot,
  type HardwareSetupStatus,
  type ScriptListEntry
} from './schemas.js';
import { t } from '../../app/i18n.js';

export const SHELLY_INVALID_RESPONSE_MESSAGE = t('hardware.shelly.invalidResponse');
export const SHELLY_OUT_OF_MEMORY_MESSAGE = t('hardware.shelly.outOfMemory');
const SHELLY_SCRIPTS_MISSING_MESSAGE = t('hardware.shelly.scriptsMissing');
const SHELLY_SCRIPTS_DISABLED_MESSAGE = t('hardware.shelly.scriptsDisabled');
const SHELLY_BLE_MISSING_MESSAGE = t('hardware.shelly.bleMissing');
const SHELLY_BLE_DISABLED_MESSAGE = t('hardware.shelly.bleDisabled');

const SHELLY_DEV_PROXY_PATH = '/__lcl_shelly_proxy';
export const SHELLY_SETUP_SCAN_CONCURRENCY = 8;
export const SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS = 3000;
const BLE_DISCOVERY_ENDPOINT_TIMEOUT_MS = 5000;

const shouldUseShellyDevProxy = (): boolean =>
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  window.location.protocol.startsWith('http');

const shouldUseNativeShellyHttp = (): boolean =>
  !shouldUseShellyDevProxy() &&
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable('CapacitorHttp');

const resolveShellyRequestUrl = (targetUrl: URL): URL => {
  if (!shouldUseShellyDevProxy()) {
    return targetUrl;
  }

  const proxyUrl = new URL(SHELLY_DEV_PROXY_PATH, window.location.origin);
  proxyUrl.searchParams.set('target', targetUrl.toString());
  return proxyUrl;
};

const headersToRecord = (headers: HeadersInit | undefined): HttpHeaders => {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, value]));
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)])
  );
};

const responseBodyToText = (response: HttpResponse): string => {
  if (typeof response.data === 'string') {
    return response.data;
  }
  if (response.data === undefined || response.data === null) {
    return '';
  }
  return JSON.stringify(response.data);
};

const abortError = (): DOMException =>
  new DOMException('Shelly request was canceled.', 'AbortError');

const nativeShellyFetch = async (
  targetUrl: URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> => {
  if (init?.signal?.aborted) {
    throw abortError();
  }

  const method = init?.method ?? 'GET';
  const body = typeof init?.body === 'string' ? init.body : undefined;
  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    abortListener = () => reject(abortError());
    init?.signal?.addEventListener('abort', abortListener, { once: true });
  });

  try {
    const nativeResponse = await Promise.race([
      CapacitorHttp.request({
        url: targetUrl.toString(),
        method,
        headers: headersToRecord(init?.headers),
        ...(body === undefined ? {} : { data: body }),
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        responseType: 'text'
      }),
      abortPromise
    ]);

    return new Response(responseBodyToText(nativeResponse), {
      status: nativeResponse.status,
      headers: nativeResponse.headers
    });
  } finally {
    if (abortListener) {
      init?.signal?.removeEventListener('abort', abortListener);
    }
  }
};

const createShellyFetch =
  (timeoutMs: number): typeof fetch =>
  async (input, init) => {
    const targetUrl =
      input instanceof URL
        ? input
        : new URL(typeof input === 'string' ? input : input.url);
    if (shouldUseNativeShellyHttp()) {
      return nativeShellyFetch(targetUrl, init, timeoutMs);
    }
    return fetch(resolveShellyRequestUrl(targetUrl), init);
  };

const combineAbortSignals = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();
  const abort = () => controller.abort();

  for (const signal of signals) {
    if (signal.aborted) {
      abort();
      break;
    }
    signal.addEventListener('abort', abort, { once: true });
  }

  return controller.signal;
};

const resultErrorMessage = (result: Result<unknown, ShellyClientError>): string =>
  result.ok
    ? 'OK'
    : result.error.kind === 'matter-enabled'
      ? t('hardware.safety.matterBlocked')
      : result.error.userMessageKey === 'errors.shellyInvalidResponse' ||
          result.error.technicalMessage?.startsWith('Shelly RPC HTTP ')
        ? SHELLY_INVALID_RESPONSE_MESSAGE
        : result.error.technicalMessage?.includes('Scripts component') ||
            result.error.technicalMessage?.includes('Script.List')
          ? SHELLY_SCRIPTS_MISSING_MESSAGE
          : result.error.technicalMessage?.includes('Scripts are disabled')
            ? SHELLY_SCRIPTS_DISABLED_MESSAGE
            : result.error.technicalMessage?.includes('BLE component')
              ? SHELLY_BLE_MISSING_MESSAGE
              : result.error.technicalMessage?.includes('BLE is disabled')
                ? SHELLY_BLE_DISABLED_MESSAGE
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

export type ShellySetupScanOutcome = {
  results: ShellySetupScanResult[];
  stopped: boolean;
};

export type ScanShellySetupUrlsOptions = {
  baseUrls: string[];
  concurrency?: number;
  signal?: AbortSignal;
  stopAfterFirst?: boolean;
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
  telemetry: HardwareSetupStatus['status']['telemetry'];
  clock: HardwareSetupStatus['status']['clock'];
};

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
      throw new Error(SHELLY_OUT_OF_MEMORY_MESSAGE);
    }
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim());
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new Error(SHELLY_INVALID_RESPONSE_MESSAGE);
    }
  } finally {
    window.clearTimeout(timeout);
  }
};

export const createShellyTransport = (baseUrl: string): FetchShellyRpcTransport =>
  new FetchShellyRpcTransport({
    baseUrl,
    defaultTimeoutMs: 8000,
    fetchImpl: createShellyFetch(8000)
  });

const createShellyScanTransport = (
  baseUrl: string,
  signal?: AbortSignal
): FetchShellyRpcTransport =>
  new FetchShellyRpcTransport({
    baseUrl,
    defaultTimeoutMs: SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS,
    fetchImpl: createShellyFetch(SHELLY_SETUP_SCAN_RPC_TIMEOUT_MS),
    ...(signal ? { signal } : {})
  });

const readScriptList = async (
  transport: FetchShellyRpcTransport
): Promise<HardwareSetupStatus['scripts']> => {
  const scriptListResult = await transport.call<unknown>({
    method: RPC_METHODS.ScriptList
  });
  const parsedScripts = scriptListSchema.safeParse(unwrapShellyResult(scriptListResult));
  if (!parsedScripts.success) {
    throw new Error(parsedScripts.error.message);
  }
  return parsedScripts.data.scripts;
};

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
        stopError = `Stop skanera BLE ${script.id}: ${resultErrorMessage(stopResult)}`;
      }
    }

    const deleteResult = await client.deleteScript(script.id);
    if (!deleteResult.ok) {
      cleanupErrors.push(
        [
          stopError,
          `Usunięcie skanera BLE ${script.id}: ${resultErrorMessage(deleteResult)}`
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
    telemetry: status.telemetry,
    clock: status.clock
  };
};

const readScriptCode = async (
  transport: FetchShellyRpcTransport,
  scriptId: number
): Promise<string> => {
  const chunks: string[] = [];
  const encoder = new TextEncoder();
  let offset = 0;
  let left = 0;

  do {
    const response = await transport.call<unknown>({
      method: RPC_METHODS.ScriptGetCode,
      params: { id: scriptId, offset, len: 1024 }
    });
    const parsed = unwrapShellyResult(response) as unknown;
    const codeChunk = zScriptCodeResponse(parsed);
    chunks.push(codeChunk.data);
    offset += encoder.encode(codeChunk.data).length;
    left = codeChunk.left;
  } while (left > 0);

  return chunks.join('');
};

const zScriptCodeResponse = (payload: unknown): { data: string; left: number } => {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'data' in payload &&
    typeof payload.data === 'string'
  ) {
    const left =
      'left' in payload && typeof payload.left === 'number'
        ? Math.max(0, Math.trunc(payload.left))
        : 0;
    return { data: payload.data, left };
  }
  throw new Error(t('hardware.shelly.invalidScriptCode'));
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

export const scanShellySetupUrls = async ({
  baseUrls,
  concurrency = SHELLY_SETUP_SCAN_CONCURRENCY,
  signal,
  stopAfterFirst = true
}: ScanShellySetupUrlsOptions): Promise<ShellySetupScanOutcome> => {
  const workerCount = Math.min(Math.max(1, Math.trunc(concurrency)), baseUrls.length);
  const foundController = new AbortController();
  const requestSignal = signal
    ? combineAbortSignals([signal, foundController.signal])
    : foundController.signal;
  const found: Array<{ index: number; result: ShellySetupScanResult }> = [];
  let nextIndex = 0;

  const runWorker = async (): Promise<void> => {
    while (
      nextIndex < baseUrls.length &&
      !requestSignal.aborted &&
      (!stopAfterFirst || found.length === 0)
    ) {
      const index = nextIndex;
      nextIndex += 1;
      const baseUrl = baseUrls[index];
      if (!baseUrl) {
        continue;
      }

      try {
        found.push({
          index,
          result: await readShellySetupScanResult(baseUrl, requestSignal)
        });
        if (stopAfterFirst) {
          foundController.abort();
          break;
        }
      } catch {
        if (requestSignal.aborted) {
          break;
        }
        // Expected during LAN discovery: most local IPs will not be Shelly devices.
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return {
    results: found
      .sort((left, right) => left.index - right.index)
      .map((entry) => entry.result),
    stopped: signal?.aborted ?? false
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
  const [status, scripts] = await Promise.all([
    client.getStatus(),
    readScriptList(transport)
  ]);

  return toControlStatus(unwrapShellyResult(status), scripts);
};

export const cleanupStaleShellyBleDiscoveryScripts = async (
  baseUrl: string
): Promise<number> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const scripts = await readScriptList(transport);
  return deleteBleDiscoveryScripts(client, scripts);
};

export const readShellyAutomationScriptState = async (
  baseUrl: string
): Promise<ShellyAutomationScriptState> => {
  const transport = createShellyTransport(baseUrl);
  const client = new RpcShellyClient(transport);
  const [status, scripts] = await Promise.all([
    client.getStatus(),
    readScriptList(transport)
  ]);
  const automationScript = findAutomationScript(scripts);

  return {
    script: automationScript,
    code: automationScript ? await readScriptCode(transport, automationScript.id) : null,
    status: toControlStatus(unwrapShellyResult(status), scripts)
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
        `Nie mogę potwierdzić stanu OFF przed usunięciem skryptu. ${
          error instanceof Error ? error.message : ''
        }`.trim(),
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
        stopError ? `Stop skryptu: ${stopError}` : null,
        `Usunięcie skryptu: ${resultErrorMessage(deleteResult)}`
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
