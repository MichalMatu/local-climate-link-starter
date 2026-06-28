export type Result<T, E extends ShellyClientError = ShellyClientError> =
  { ok: true; value: T } | { ok: false; error: E };

export type ShellyErrorKind =
  | 'matter-enabled'
  | 'script-upload-failed'
  | 'relay-test-failed'
  | 'timeout'
  | 'validation-failed'
  | 'shelly-offline'
  | 'unknown';

export interface ShellyClientError {
  kind: ShellyErrorKind;
  userMessageKey: string;
  technicalMessage?: string;
  retryable: boolean;
}

export interface ShellyRpcRequest<TParams = unknown> {
  method: ShellyRpcMethod;
  params?: TParams;
}

export interface ShellyRpcTransport {
  call<TResponse>(
    request: ShellyRpcRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<Result<TResponse>>;
}

export interface ShellyDeviceInfo {
  model: string;
  gen: number;
  firmwareId?: string | undefined;
  matterEnabled?: boolean | undefined;
}

export interface ShellyPlugTelemetry {
  powerW?: number | undefined;
  voltageV?: number | undefined;
  currentA?: number | undefined;
  energyWh?: number | undefined;
  deviceTemperatureC?: number | undefined;
  wifiRssiDbm?: number | undefined;
}

export interface ShellyClockStatus {
  localTime?: string | undefined;
  unixTimeSec?: number | undefined;
  uptimeSec?: number | undefined;
  lastSyncUnixTimeSec?: number | undefined;
  timeSynced: boolean;
}

export type ShellyComponentState = 'enabled' | 'disabled' | 'missing';

export interface ShellyStatus {
  matterEnabled: boolean;
  scripts: ShellyComponentState;
  bluetooth: ShellyComponentState;
  relayOn: boolean;
  telemetry: ShellyPlugTelemetry;
  clock: ShellyClockStatus;
}

export interface ShellyInstallPlan {
  scriptName: string;
  code: string;
  runOnBoot: boolean;
  backupExisting: boolean;
  chunkSizeBytes?: number | undefined;
}

export interface ShellyScriptBackup {
  scriptId: number;
  name: string;
  running: boolean;
  enable: boolean;
  code?: string | undefined;
  codeHash?: string | undefined;
  errorMessage?: string | undefined;
}

export interface ShellyInstallResult {
  scriptId: number;
  running: boolean;
  memUsed?: number | undefined;
  memFree?: number | undefined;
  scriptHash: string;
  backup?: ShellyScriptBackup | undefined;
}

export interface RelayTestResult {
  finalRelayOn: boolean;
  onCommandSent: boolean;
  offCommandSent: boolean;
}

export interface ShellyClient {
  getDeviceInfo(): Promise<Result<ShellyDeviceInfo>>;
  getStatus(): Promise<Result<ShellyStatus>>;
  installScript(plan: ShellyInstallPlan): Promise<Result<ShellyInstallResult>>;
  stopScript(scriptId: number): Promise<Result<null>>;
  startScript(scriptId: number): Promise<Result<null>>;
  deleteScript(scriptId: number): Promise<Result<null>>;
  setRelayOn(options?: { relayId?: number }): Promise<Result<null>>;
  setRelayOff(options?: { relayId?: number }): Promise<Result<null>>;
  safeRelayTest(options?: { onDurationMs?: number }): Promise<Result<RelayTestResult>>;
}

export const RPC_METHODS = {
  ShellyGetDeviceInfo: 'Shelly.GetDeviceInfo',
  ShellyGetStatus: 'Shelly.GetStatus',
  ScriptList: 'Script.List',
  ScriptCreate: 'Script.Create',
  ScriptGetCode: 'Script.GetCode',
  ScriptStop: 'Script.Stop',
  ScriptDelete: 'Script.Delete',
  ScriptEval: 'Script.Eval',
  ScriptPutCode: 'Script.PutCode',
  ScriptSetConfig: 'Script.SetConfig',
  ScriptStart: 'Script.Start',
  ScriptGetStatus: 'Script.GetStatus',
  SwitchGetStatus: 'Switch.GetStatus',
  SwitchSet: 'Switch.Set'
} as const;

export type ShellyRpcMethod = (typeof RPC_METHODS)[keyof typeof RPC_METHODS];

export const LOCAL_CLIMATE_LINK_SCRIPT_NAME = 'Local Climate Link Thermostat';
export const LOCAL_CLIMATE_LINK_BLE_DISCOVERY_SCRIPT_NAME =
  'Local Climate Link BLE Discovery';
