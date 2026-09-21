export type ShellyClientErrorKind =
  | 'invalid-host'
  | 'request-failed'
  | 'timeout'
  | 'invalid-response'
  | 'validation-failed'
  | 'matter-enabled'
  | 'scripts-unavailable'
  | 'script-upload-failed'
  | 'script-start-failed'
  | 'script-delete-failed'
  | 'relay-test-failed';

export interface ShellyClientError {
  kind: ShellyClientErrorKind;
  userMessageKey: string;
  technicalMessage: string;
  retryable: boolean;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ShellyClientError };

export interface ShellyDeviceInfo {
  id?: string | undefined;
  model: string;
  gen: number;
  firmwareId?: string | undefined;
  matterEnabled?: boolean | undefined;
}

export interface ShellyPlugTelemetry {
  powerW: number | null;
  voltageV: number | null;
  currentA: number | null;
  energyWh: number | null;
  deviceTemperatureC: number | null;
  wifiRssiDbm: number | null;
}

export interface ShellyClockStatus {
  localTime: string | null;
  unixTimeSec: number | null;
  uptimeSec: number | null;
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

export interface ShellyScriptStorageItem {
  supported: boolean;
  value: string | null;
}

export interface ShellyClient {
  getDeviceInfo(): Promise<Result<ShellyDeviceInfo>>;
  getStatus(): Promise<Result<ShellyStatus>>;
  installScript(plan: ShellyInstallPlan): Promise<Result<ShellyInstallResult>>;
  stopScript(scriptId: number): Promise<Result<null>>;
  startScript(scriptId: number): Promise<Result<null>>;
  deleteScript(scriptId: number): Promise<Result<null>>;
  evaluateScript(scriptId: number, code: string): Promise<Result<string | null>>;
  readScriptStorageItem(
    scriptId: number,
    key: string
  ): Promise<Result<ShellyScriptStorageItem>>;
  setRelayOn(options?: { relayId?: number }): Promise<Result<null>>;
  setRelayOff(options?: { relayId?: number }): Promise<Result<null>>;
  safeRelayTest(options?: { onDurationMs?: number }): Promise<Result<RelayTestResult>>;
}

export const RPC_METHODS = {
  ShellyGetDeviceInfo: 'Shelly.GetDeviceInfo',
  ShellyGetStatus: 'Shelly.GetStatus',
  SysGetStatus: 'Sys.GetStatus',
  ShellyListMethods: 'Shelly.ListMethods',
  ScriptList: 'Script.List',
  ScriptCreate: 'Script.Create',
  ScriptGetCode: 'Script.GetCode',
  ScriptPutCode: 'Script.PutCode',
  ScriptSetConfig: 'Script.SetConfig',
  ScriptStart: 'Script.Start',
  ScriptStop: 'Script.Stop',
  ScriptDelete: 'Script.Delete',
  ScriptGetStatus: 'Script.GetStatus',
  ScriptEval: 'Script.Eval',
  SwitchSet: 'Switch.Set',
  SwitchGetStatus: 'Switch.GetStatus',
  ScheduleList: 'Schedule.List',
  ScheduleCreate: 'Schedule.Create',
  ScheduleUpdate: 'Schedule.Update',
  ScheduleDelete: 'Schedule.Delete'
} as const;

export type ShellyRpcMethod = (typeof RPC_METHODS)[keyof typeof RPC_METHODS];

export interface ShellyRpcRequest {
  method: ShellyRpcMethod;
  params?: Record<string, unknown>;
}

export interface ShellyRpcTransport {
  call<TResponse>(request: ShellyRpcRequest): Promise<Result<TResponse>>;
}
