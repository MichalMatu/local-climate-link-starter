import {
  LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  type Result,
  type RelayTestResult,
  type ShellyClient,
  type ShellyDeviceInfo,
  type ShellyInstallPlan,
  type ShellyInstallResult,
  type ShellyRpcRequest,
  type ShellyRpcTransport,
  type ShellyStatus
} from '../model.js';
import {
  parseShellyDeviceInfoResponse,
  parseShellyStatusResponse
} from '../rpc/deviceStatus.js';
import { validationError } from '../rpc/errors.js';
import { runSafeShellyRelayTest, setShellyRelayState } from '../rpc/relay.js';
import {
  DEFAULT_PUT_CODE_CHUNK_SIZE_BYTES,
  installShellyScript
} from './installLifecycle.js';

const DEFAULT_SCRIPT_MUTATION_DELAY_MS = 100;

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
    return response.ok ? parseShellyDeviceInfoResponse(response.value) : response;
  }

  async getStatus(): Promise<Result<ShellyStatus>> {
    const response = await this.transport.call<unknown>({
      method: RPC_METHODS.ShellyGetStatus
    });
    return response.ok ? parseShellyStatusResponse(response.value) : response;
  }

  async installScript(plan: ShellyInstallPlan): Promise<Result<ShellyInstallResult>> {
    return installShellyScript(
      {
        transport: this.transport,
        callMutation: (request) => this.callMutation<unknown>(request),
        sleepMs: this.sleepMs,
        getDeviceInfo: () => this.getDeviceInfo(),
        getStatus: () => this.getStatus()
      },
      plan
    );
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
