import {
  LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  type Result,
  type RelayTestResult,
  type ShellyClient,
  type ShellyClientError,
  type ShellyDeviceInfo,
  type ShellyInstallPlan,
  type ShellyInstallResult,
  type ShellyScriptBackup,
  type ShellyRpcRequest,
  type ShellyRpcTransport,
  type ShellyStatus
} from '../model.js';
import { scriptCreateResponseSchema, scriptStatusSchema } from '../rpc/validators.js';
import {
  parseShellyDeviceInfoResponse,
  parseShellyStatusResponse
} from '../rpc/deviceStatus.js';
import { validationError } from '../rpc/errors.js';
import { runSafeShellyRelayTest, setShellyRelayState } from '../rpc/relay.js';
import { hashScriptCode } from './hash.js';
import { readShellyScriptCode, readShellyScriptList } from './read.js';

const DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES = 1024;
const DEFAULT_SCRIPT_MUTATION_DELAY_MS = 100;
const BLE_SCANNER_CLEANUP_DELAY_MS = 1000;
const STOP_BLE_SCANNER_EVAL_CODE =
  'if(typeof BLE!=="undefined"&&BLE.Scanner){var s=BLE.Scanner.stop||BLE.Scanner.Stop;if(s)s.call(BLE.Scanner);}"ok"';

export interface RpcShellyClientOptions {
  mutationDelayMs?: number | undefined;
  sleepMs?: ((durationMs: number) => Promise<void>) | undefined;
}

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

  private async stopBleScannerInScript(scriptId: number): Promise<void> {
    await this.callMutation<unknown>({
      method: RPC_METHODS.ScriptEval,
      params: { id: scriptId, code: STOP_BLE_SCANNER_EVAL_CODE }
    });
    await this.sleepMs(BLE_SCANNER_CLEANUP_DELAY_MS);
  }

  async getDeviceInfo(): Promise<Result<ShellyDeviceInfo>> {
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ShellyGetDeviceInfo
    });
    return response.ok ? parseShellyDeviceInfoResponse(response.value) : response;
  }

  async getStatus(): Promise<Result<ShellyStatus>> {
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ShellyGetStatus
    });
    return response.ok ? parseShellyStatusResponse(response.value) : response;
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
    const codeResult = await readShellyScriptCode(this.transport, script.id, {
      chunkSizeBytes
    });
    if (!codeResult.ok) {
      return {
        ...backupBase,
        errorMessage:
          codeResult.error.technicalMessage ??
          `Script.GetCode failed with ${codeResult.error.kind}.`
      };
    }

    const code = codeResult.value;
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
    const list = await readShellyScriptList(this.transport);
    if (!list.ok) {
      return {
        ok: false,
        error: scriptUploadError(
          `Script.List failed: ${list.error.technicalMessage ?? list.error.kind}`
        )
      };
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
    const existingScript = list.value.find((script) => script.name === plan.scriptName);
    let backup: ShellyScriptBackup | undefined;
    let scriptId: number;

    if (existingScript) {
      backup = plan.backupExisting
        ? await this.backupExistingScript(existingScript, chunkSizeBytes)
        : undefined;
      scriptId = existingScript.id;

      if (existingScript.running) {
        await this.stopBleScannerInScript(scriptId);
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
    return setShellyRelayState(
      (request) => this.callMutation<null>(request),
      on,
      options
    );
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
    return runSafeShellyRelayTest(
      this.transport,
      (request) => this.callMutation<null>(request),
      options
    );
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
