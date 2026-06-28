import {
  LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  type Result,
  type RelayTestResult,
  type ShellyClient,
  type ShellyClientError,
  type ShellyClockStatus,
  type ShellyComponentState,
  type ShellyDeviceInfo,
  type ShellyInstallPlan,
  type ShellyInstallResult,
  type ShellyPlugTelemetry,
  type ShellyScriptBackup,
  type ShellyRpcRequest,
  type ShellyRpcTransport,
  type ShellyStatus
} from '../model.js';
import {
  scriptCodeResponseSchema,
  scriptCreateResponseSchema,
  scriptListResponseSchema,
  scriptStatusSchema,
  shellyDeviceInfoSchema,
  switchStatusSchema,
  sysStatusSchema,
  wifiStatusSchema
} from '../rpc/validators.js';
import { hashScriptCode } from './hash.js';

const DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES = 1024;
const DEFAULT_SCRIPT_MUTATION_DELAY_MS = 100;
const MIN_SYNCED_UNIX_TIME_SEC = 1_600_000_000;

export interface RpcShellyClientOptions {
  mutationDelayMs?: number | undefined;
  sleepMs?: ((durationMs: number) => Promise<void>) | undefined;
}

const validationError = (message: string) => ({
  kind: 'validation-failed' as const,
  userMessageKey: 'errors.validationFailed',
  technicalMessage: message,
  retryable: false
});

const validateScriptId = (scriptId: number): Result<number> => {
  if (!Number.isInteger(scriptId) || scriptId < 0) {
    return {
      ok: false,
      error: validationError(`Invalid Shelly script id: ${scriptId}.`)
    };
  }

  return { ok: true, value: scriptId };
};

const scriptUploadError = (message: string): ShellyClientError => ({
  kind: 'script-upload-failed',
  userMessageKey: 'errors.scriptUploadFailed',
  technicalMessage: message,
  retryable: true
});

const relayTestError = (message: string): ShellyClientError => ({
  kind: 'relay-test-failed',
  userMessageKey: 'errors.relayTestFailed',
  technicalMessage: message,
  retryable: true
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const componentState = (value: unknown): ShellyComponentState => {
  if (value === undefined || value === null) {
    return 'missing';
  }
  if (value === false) {
    return 'disabled';
  }
  if (value === true) {
    return 'enabled';
  }
  if (isRecord(value) && (value.enable === false || value.enabled === false)) {
    return 'disabled';
  }
  return isRecord(value) ? 'enabled' : 'missing';
};

const matterEnabled = (value: unknown): boolean =>
  value === true ||
  (isRecord(value) && (value.enable === true || value.enabled === true));

const toShellyPlugTelemetry = (
  switchStatus: ReturnType<typeof switchStatusSchema.safeParse>,
  wifiStatus: ReturnType<typeof wifiStatusSchema.safeParse>
): ShellyPlugTelemetry => {
  const telemetry: ShellyPlugTelemetry = {};
  if (switchStatus.success) {
    const data = switchStatus.data;
    if (data.apower !== undefined) {
      telemetry.powerW = data.apower;
    }
    if (data.voltage !== undefined) {
      telemetry.voltageV = data.voltage;
    }
    if (data.current !== undefined) {
      telemetry.currentA = data.current;
    }
    if (data.aenergy?.total !== undefined) {
      telemetry.energyWh = data.aenergy.total;
    }
    if (data.temperature?.tC !== undefined) {
      telemetry.deviceTemperatureC = data.temperature.tC;
    }
  }
  if (wifiStatus.success && wifiStatus.data.rssi !== undefined) {
    telemetry.wifiRssiDbm = wifiStatus.data.rssi;
  }
  return telemetry;
};

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const toShellyClockStatus = (
  sysStatus: ReturnType<typeof sysStatusSchema.safeParse>
): ShellyClockStatus => {
  if (!sysStatus.success) {
    return { timeSynced: false };
  }

  const localTime =
    typeof sysStatus.data.time === 'string' && sysStatus.data.time.trim() !== ''
      ? sysStatus.data.time
      : undefined;
  const unixTimeSec = finiteNumber(sysStatus.data.unixtime);
  const uptimeSec = finiteNumber(sysStatus.data.uptime);
  const lastSyncUnixTimeSec = finiteNumber(sysStatus.data.last_sync_ts);

  return {
    ...(localTime ? { localTime } : {}),
    ...(unixTimeSec !== undefined ? { unixTimeSec } : {}),
    ...(uptimeSec !== undefined ? { uptimeSec } : {}),
    ...(lastSyncUnixTimeSec !== undefined ? { lastSyncUnixTimeSec } : {}),
    timeSynced: unixTimeSec !== undefined && unixTimeSec >= MIN_SYNCED_UNIX_TIME_SEC
  };
};

const chunkUtf8String = (value: string, maxBytes: number): string[] => {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;

  for (const character of value) {
    const characterBytes = encoder.encode(character).length;
    if (chunk !== '' && chunkBytes + characterBytes > maxBytes) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += character;
    chunkBytes += characterBytes;
  }

  if (chunk !== '') {
    return [...chunks, chunk];
  }

  return chunks.length > 0 ? chunks : [''];
};

const defaultSleep = (durationMs: number): Promise<void> =>
  durationMs <= 0
    ? Promise.resolve()
    : new Promise((resolve) => {
        setTimeout(resolve, durationMs);
      });

export class RpcShellyClient implements ShellyClient {
  private readonly mutationDelayMs: number;
  private readonly sleepMs: (durationMs: number) => Promise<void>;

  constructor(
    private readonly transport: ShellyRpcTransport,
    options: RpcShellyClientOptions = {}
  ) {
    this.mutationDelayMs = options.mutationDelayMs ?? DEFAULT_SCRIPT_MUTATION_DELAY_MS;
    this.sleepMs = options.sleepMs ?? defaultSleep;
  }

  private async callMutation<TResponse>(
    request: ShellyRpcRequest
  ): Promise<Result<TResponse>> {
    const result = await this.transport.call<TResponse>(request);
    if (result.ok) {
      await this.sleepMs(this.mutationDelayMs);
    }
    return result;
  }

  async getDeviceInfo(): Promise<Result<ShellyDeviceInfo>> {
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ShellyGetDeviceInfo
    });
    if (!response.ok) {
      return response;
    }

    const parsed = shellyDeviceInfoSchema.safeParse(response.value);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: validationError(parsed.error.message) };
  }

  async getStatus(): Promise<Result<ShellyStatus>> {
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ShellyGetStatus
    });
    if (!response.ok) {
      return response;
    }

    const status = isRecord(response.value) ? response.value : {};
    const switchStatus = switchStatusSchema.safeParse(status['switch:0']);
    const wifiStatus = wifiStatusSchema.safeParse(status.wifi);
    const sysStatus = sysStatusSchema.safeParse(status.sys);
    return {
      ok: true,
      value: {
        matterEnabled: matterEnabled(status.matter),
        scripts: componentState(status.script),
        bluetooth: componentState(status.ble),
        relayOn: switchStatus.success ? switchStatus.data.output : false,
        telemetry: toShellyPlugTelemetry(switchStatus, wifiStatus),
        clock: toShellyClockStatus(sysStatus)
      }
    };
  }

  private async backupExistingScript(
    script: { id: number; name: string; enable: boolean; running: boolean },
    chunkSizeBytes: number
  ): Promise<ShellyScriptBackup> {
    const backupBase = {
      scriptId: script.id,
      name: script.name,
      enable: script.enable,
      running: script.running
    };
    const chunks: string[] = [];
    const encoder = new TextEncoder();
    let offset = 0;
    let left = 0;

    do {
      const response = await this.transport.call<unknown>({
        method: RPC_METHODS.ScriptGetCode,
        params: { id: script.id, offset, len: chunkSizeBytes }
      });
      if (!response.ok) {
        return {
          ...backupBase,
          errorMessage:
            response.error.technicalMessage ??
            `Script.GetCode failed with ${response.error.kind}.`
        };
      }
      const parsed = scriptCodeResponseSchema.safeParse(response.value);
      if (!parsed.success) {
        return {
          ...backupBase,
          errorMessage: parsed.error.message
        };
      }

      chunks.push(parsed.data.data);
      offset += encoder.encode(parsed.data.data).length;
      left = parsed.data.left;
    } while (left > 0);

    const code = chunks.join('');
    return {
      ...backupBase,
      code,
      codeHash: hashScriptCode(`${script.name}:${code}`)
    };
  }

  async installScript(plan: ShellyInstallPlan): Promise<Result<ShellyInstallResult>> {
    const [deviceInfo, status] = await Promise.all([
      this.getDeviceInfo(),
      this.getStatus()
    ]);
    if (!deviceInfo.ok) {
      return deviceInfo;
    }
    if (!status.ok) {
      return status;
    }
    if (deviceInfo.value.matterEnabled || status.value.matterEnabled) {
      return {
        ok: false,
        error: {
          kind: 'matter-enabled',
          userMessageKey: 'errors.matterEnabled',
          technicalMessage: 'Matter is enabled; Shelly Scripts are blocked.',
          retryable: false
        }
      };
    }
    const list = await this.transport.call<unknown>({ method: RPC_METHODS.ScriptList });
    if (!list.ok) {
      return {
        ok: false,
        error: scriptUploadError(
          `Script.List failed: ${list.error.technicalMessage ?? list.error.kind}`
        )
      };
    }
    const parsedList = scriptListResponseSchema.safeParse(list.value);
    if (!parsedList.success) {
      return { ok: false, error: validationError(parsedList.error.message) };
    }

    if (status.value.scripts === 'disabled') {
      return {
        ok: false,
        error: scriptUploadError('Shelly Scripts are disabled on this device.')
      };
    }
    if (status.value.bluetooth !== 'enabled') {
      return {
        ok: false,
        error: scriptUploadError(
          status.value.bluetooth === 'missing'
            ? 'Shelly.GetStatus did not expose the BLE component.'
            : 'Shelly BLE is disabled on this device.'
        )
      };
    }

    const chunkSizeBytes = plan.chunkSizeBytes ?? DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES;
    const existingScript = parsedList.data.scripts.find(
      (script) => script.name === plan.scriptName
    );
    let backup: ShellyScriptBackup | undefined;
    let scriptId: number;

    if (existingScript) {
      backup = plan.backupExisting
        ? await this.backupExistingScript(existingScript, chunkSizeBytes)
        : undefined;
      scriptId = existingScript.id;

      if (existingScript.running) {
        const stopResult = await this.callMutation<null>({
          method: RPC_METHODS.ScriptStop,
          params: { id: scriptId }
        });
        if (!stopResult.ok) {
          return stopResult;
        }
      }
    } else {
      const created = await this.callMutation<unknown>({
        method: RPC_METHODS.ScriptCreate,
        params: { name: plan.scriptName }
      });
      if (!created.ok) {
        return created;
      }
      const parsedCreate = scriptCreateResponseSchema.safeParse(created.value);
      if (!parsedCreate.success) {
        return { ok: false, error: validationError(parsedCreate.error.message) };
      }
      scriptId = parsedCreate.data.id;
    }

    const codeChunks = chunkUtf8String(plan.code, chunkSizeBytes);
    for (let index = 0; index < codeChunks.length; index += 1) {
      const putResult = await this.callMutation<null>({
        method: RPC_METHODS.ScriptPutCode,
        params: {
          id: scriptId,
          code: codeChunks[index],
          append: index > 0
        }
      });
      if (!putResult.ok) {
        return putResult;
      }
    }

    const configResult = await this.callMutation<null>({
      method: RPC_METHODS.ScriptSetConfig,
      params: { id: scriptId, config: { enable: plan.runOnBoot } }
    });
    if (!configResult.ok) {
      return configResult;
    }

    const startResult = await this.callMutation<null>({
      method: RPC_METHODS.ScriptStart,
      params: { id: scriptId }
    });
    if (!startResult.ok) {
      return startResult;
    }

    const scriptStatus = await this.transport.call<unknown>({
      method: RPC_METHODS.ScriptGetStatus,
      params: { id: scriptId }
    });
    if (!scriptStatus.ok) {
      return scriptStatus;
    }
    const parsedStatus = scriptStatusSchema.safeParse(scriptStatus.value);
    if (!parsedStatus.success) {
      return { ok: false, error: validationError(parsedStatus.error.message) };
    }
    if (
      parsedStatus.data.running !== true ||
      parsedStatus.data.error !== undefined ||
      (parsedStatus.data.errors?.length ?? 0) > 0
    ) {
      return {
        ok: false,
        error: scriptUploadError('Script.GetStatus did not confirm a running script.')
      };
    }

    return {
      ok: true,
      value: {
        scriptId,
        running: parsedStatus.data.running ?? true,
        memUsed: parsedStatus.data.mem_used,
        memFree: parsedStatus.data.mem_free,
        scriptHash: hashScriptCode(`${plan.scriptName}:${plan.code}`),
        backup
      }
    };
  }

  async stopScript(scriptId: number): Promise<Result<null>> {
    const parsedScriptId = validateScriptId(scriptId);
    if (!parsedScriptId.ok) {
      return parsedScriptId;
    }

    return this.callMutation<null>({
      method: RPC_METHODS.ScriptStop,
      params: { id: parsedScriptId.value }
    });
  }

  async startScript(scriptId: number): Promise<Result<null>> {
    const parsedScriptId = validateScriptId(scriptId);
    if (!parsedScriptId.ok) {
      return parsedScriptId;
    }

    return this.callMutation<null>({
      method: RPC_METHODS.ScriptStart,
      params: { id: parsedScriptId.value }
    });
  }

  async deleteScript(scriptId: number): Promise<Result<null>> {
    const parsedScriptId = validateScriptId(scriptId);
    if (!parsedScriptId.ok) {
      return parsedScriptId;
    }

    return this.callMutation<null>({
      method: RPC_METHODS.ScriptDelete,
      params: { id: parsedScriptId.value }
    });
  }

  private setRelayState(
    on: boolean,
    options?: { relayId?: number }
  ): Promise<Result<null>> {
    const relayId = options?.relayId ?? 0;
    if (!Number.isInteger(relayId) || relayId < 0) {
      return Promise.resolve({
        ok: false,
        error: validationError(`Invalid Shelly relay id: ${relayId}.`)
      });
    }

    return this.callMutation<null>({
      method: RPC_METHODS.SwitchSet,
      params: { id: relayId, on }
    });
  }

  async setRelayOn(options?: { relayId?: number }): Promise<Result<null>> {
    return this.setRelayState(true, options);
  }

  async setRelayOff(options?: { relayId?: number }): Promise<Result<null>> {
    return this.setRelayState(false, options);
  }

  async safeRelayTest(options?: {
    onDurationMs?: number;
  }): Promise<Result<RelayTestResult>> {
    const onDurationMs = options?.onDurationMs ?? 100;
    let onCommandSent = false;
    let offCommandSent = false;
    let onError: ShellyClientError | undefined;
    let offError: ShellyClientError | undefined;

    try {
      const on = await this.setRelayOn();
      if (!on.ok) {
        onError = on.error;
      } else {
        onCommandSent = true;
        await new Promise((resolve) => setTimeout(resolve, onDurationMs));
      }
    } finally {
      const off = await this.setRelayOff();
      offCommandSent = off.ok;
      if (!off.ok) {
        offError = off.error;
      }
    }

    if (offError) {
      return {
        ok: false,
        error: relayTestError(
          `Final relay OFF command failed; final state could not be confirmed. ${
            offError.technicalMessage ?? offError.kind
          }`
        )
      };
    }

    if (onError) {
      return { ok: false, error: onError };
    }

    const status = await this.transport.call<unknown>({
      method: RPC_METHODS.SwitchGetStatus,
      params: { id: 0 }
    });
    if (!status.ok) {
      return status;
    }
    const parsed = switchStatusSchema.safeParse(status.value);
    if (!parsed.success) {
      return { ok: false, error: validationError(parsed.error.message) };
    }
    if (parsed.data.output) {
      return {
        ok: false,
        error: relayTestError('Final relay state is ON after the safe relay test.')
      };
    }

    return {
      ok: true,
      value: {
        finalRelayOn: parsed.data.output,
        onCommandSent,
        offCommandSent
      }
    };
  }
}

export const createInstallPlan = (code: string): ShellyInstallPlan => ({
  scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  code,
  runOnBoot: true,
  backupExisting: true,
  chunkSizeBytes: DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES
});

export const createBleDiscoveryInstallPlan = (code: string): ShellyInstallPlan => ({
  scriptName: LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  code,
  runOnBoot: false,
  backupExisting: false,
  chunkSizeBytes: DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES
});
