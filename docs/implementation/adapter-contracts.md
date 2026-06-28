# Adapter contracts

All hardware and platform APIs must be hidden behind ports/interfaces. React screens must not call Capacitor BLE or Shelly RPC directly.

## Result type

```ts
export type Result<T, E extends AppError = AppError> =
  { ok: true; value: T } | { ok: false; error: E };
```

Ordinary invalid input returns `Result`. Throw only for programmer errors that should fail tests.

## App errors

```ts
export type ErrorKind =
  | 'permission-denied'
  | 'ble-unavailable'
  | 'sensor-unsupported'
  | 'sensor-stale'
  | 'shelly-offline'
  | 'shelly-unsupported'
  | 'matter-enabled'
  | 'script-upload-failed'
  | 'relay-test-failed'
  | 'validation-failed'
  | 'timeout'
  | 'unknown';

export interface AppError {
  kind: ErrorKind;
  userMessageKey: string;
  technicalMessage?: string;
  cause?: unknown;
  retryable: boolean;
}
```

## BLE scanner port

```ts
export interface ScanOptions {
  serviceUuids?: string[];
  rssiMin?: number;
  timeoutMs?: number;
}

export interface NormalizedBleAdvertisement {
  id: string;
  name?: string;
  rssi?: number;
  serviceUuids: string[];
  serviceData: Record<string, Uint8Array>;
  manufacturerData: Record<string, Uint8Array>;
  rawAdvertisement?: Uint8Array;
  seenAtMs: number;
  platform: 'android' | 'ios' | 'web' | 'demo';
}

export interface BleScanner {
  startScan(options: ScanOptions): AsyncIterable<NormalizedBleAdvertisement>;
  stopScan(): Promise<void>;
}
```

Rules:

```text
Normalize platform data at the adapter boundary.
Do not expose Capacitor plugin shapes to domain packages.
Do not treat iOS scan ID as stable hardware MAC.
Always stop scan on cancellation/unmount.
```

## Parsed sensor advertisement

```ts
export type SensorProfileId = 'xiaomi_lywsd03mmc_bthome_v2' | 'tp357_custom_v1';

export interface Measurement {
  sensorId: string;
  source: 'phone-scan' | 'shelly-scan' | 'demo';
  temperatureC?: number;
  humidityPct?: number;
  batteryPct?: number;
  rssi?: number;
  seenAtMs: number;
}

export interface ParsedSensorAdvertisement {
  profileId: SensorProfileId;
  measurement: Measurement;
  confidence: 'high' | 'medium' | 'low';
  rawKind: 'bthome-v2' | 'tp357-custom';
}
```

## Automation engine port

```ts
export type AutomationMode = 'heating' | 'cooling' | 'humidifying' | 'dehumidifying';
export type RuleControlMetric = 'temperature' | 'humidity';
export type ThresholdDirection = 'below' | 'above';
export type RulePresetId = AutomationMode;

export interface ThresholdControl {
  metric: RuleControlMetric;
  direction: ThresholdDirection;
  onThreshold: number;
  offThreshold: number;
}

export interface VpdAssistConfig {
  enabled: boolean;
  targetKpa: number;
}

export interface ThermostatRule {
  mode: AutomationMode;
  control: ThresholdControl;
  vpdAssist: VpdAssistConfig;
  staleTimeoutSec: number;
  minChangeMs: number;
  maxOnMs: number;
  rssiMin?: number;
  consecutiveHits: number;
  failSafe: 'off';
  bootState: 'off';
}

export interface AutomationState {
  relayOn: boolean;
  lastSeenMs?: number;
  lastChangeMs?: number;
  onStartedMs?: number;
  onHits: number;
  offHits: number;
}

export type RelayDecisionReason =
  | 'below-threshold'
  | 'above-threshold'
  | 'inside-band'
  | 'sensor-stale'
  | 'boot-safe-off'
  | 'max-on-time'
  | 'min-change-blocked'
  | 'control-value-missing';

export interface AutomationDecision {
  requestedRelayOn: boolean;
  shouldCallRelay: boolean;
  reason: RelayDecisionReason;
  nextState: AutomationState;
}
```

## Shelly client port

```ts
export interface ShellyRpcRequest<TParams = unknown> {
  method: string;
  params?: TParams;
}

export interface ShellyRpcTransport {
  call<TResponse>(
    request: ShellyRpcRequest,
    options?: { timeoutMs?: number }
  ): Promise<Result<TResponse>>;
}

export interface ShellyInstallPlan {
  scriptName: 'Local Climate Link Thermostat';
  code: string;
  runOnBoot: true;
  backupExisting: true;
}

export interface ShellyInstallResult {
  scriptId: number;
  running: boolean;
  memUsed?: number;
  memFree?: number;
  scriptHash: string;
}
```

Rules:

```text
Every RPC call has timeout.
Every response is validated at boundary.
Script.PutCode stops existing script first.
Safe relay test always sends final OFF.
Do not require Shelly Cloud.
```

## Storage port

```ts
export interface StorageRepository {
  loadSetupDraft(): Promise<Result<SetupDraft | null>>;
  saveSetupDraft(draft: SetupDraft): Promise<Result<void>>;
  loadInstalledSetup(id: string): Promise<Result<InstalledSetup | null>>;
  saveInstalledSetup(setup: InstalledSetup): Promise<Result<void>>;
}
```

No package should directly import `localStorage`, Capacitor Preferences, IndexedDB, or filesystem APIs except the platform adapter package/app layer.
