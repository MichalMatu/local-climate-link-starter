import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const USAGE =
  'Usage: SHELLY_URL=http://<shelly-ip> [SCRIPT_ID=1] [SOAK_INTERVAL_MS=5000] [SOAK_CYCLE_RELAY=1] pnpm hardware:shelly:soak';

type JsonRecord = Record<string, unknown>;
type RuleMetric = 'temperature' | 'humidity';
type RuleDirection = 'below' | 'above';
type CyclePhase = 'on' | 'off';

type EndpointResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; status?: number | undefined };

interface CycleOptions {
  enabled: boolean;
  periodMs: number;
  margin?: number | undefined;
  minChangeMs: number;
  maxOnMs: number;
  consecutiveHits: number;
  finalOff: boolean;
  stopScriptOnFinish: boolean;
}

interface CycleState {
  nextPhase: CyclePhase;
  lastAtMs?: number | undefined;
  originalConfig?: RuntimeConfigSnapshot | undefined;
  requests: number;
  skips: number;
  errors: number;
  lastPhase?: CyclePhase | undefined;
  lastReason?: string | undefined;
}

interface CycleThresholdPlan {
  phase: CyclePhase;
  metric: RuleMetric;
  direction: RuleDirection;
  controlValue: number;
  margin: number;
  onThreshold: number;
  offThreshold: number;
  minChangeMs: number;
  maxOnMs: number;
  consecutiveHits: number;
}

interface RuntimeConfigSnapshot {
  on: number;
  off: number;
  minChangeMs: number;
  consecutiveHits: number;
  maxOnMs: number;
  vpdTargetKpa?: number | undefined;
}

interface ParsedSample {
  device: {
    model?: string | undefined;
    firmwareId?: string | undefined;
    uptimeSec?: number | undefined;
    wifiRssiDbm?: number | undefined;
  };
  script: {
    id: number;
    running?: boolean | undefined;
    memUsed?: number | undefined;
    memPeak?: number | undefined;
    memFree?: number | undefined;
    errors?: unknown[] | undefined;
  };
  relay: {
    rpcOn?: boolean | undefined;
    diagOn?: boolean | undefined;
    powerW?: number | undefined;
    voltageV?: number | undefined;
    currentA?: number | undefined;
    energyWh?: number | undefined;
    deviceTemperatureC?: number | undefined;
  };
  sensor: {
    runtimeAddress?: string | undefined;
    displayName?: string | undefined;
    lastSeenUptimeMs?: number | undefined;
    lastPacketSeenUptimeMs?: number | undefined;
    ageSinceMeasurementMs?: number | undefined;
    ageSincePacketMs?: number | undefined;
    temperatureC?: number | undefined;
    humidityPct?: number | undefined;
    batteryPct?: number | undefined;
    rssiDbm?: number | undefined;
  };
  rule: {
    metric?: 'temperature' | 'humidity' | undefined;
    direction?: 'below' | 'above' | undefined;
    onThreshold?: number | undefined;
    offThreshold?: number | undefined;
    staleTimeoutSec?: number | undefined;
    rssiMin?: number | undefined;
    scriptHash?: string | undefined;
  };
  decision: {
    reason?: string | undefined;
    dataState?: string | undefined;
    lastChangeUptimeMs?: number | undefined;
    onStartedUptimeMs?: number | undefined;
    onHits?: number | undefined;
    offHits?: number | undefined;
    controlValue?: number | undefined;
    vpdKpa?: number | undefined;
    effectiveOnThreshold?: number | undefined;
    effectiveOffThreshold?: number | undefined;
  };
}

interface SummaryState {
  startedAtIso: string;
  finishedAtIso?: string | undefined;
  stopReason?: string | undefined;
  samples: number;
  okSamples: number;
  failedSamples: number;
  diagFailures: number;
  rpcFailures: number;
  scriptNotRunningSamples: number;
  relayChanges: number;
  samplesWithMeasurement: number;
  samplesWithPacket: number;
  maxNoMeasurementUpdateMs: number;
  maxNoPacketUpdateMs: number;
  memUsedMax?: number | undefined;
  memPeakMax?: number | undefined;
  memFreeMin?: number | undefined;
  rssiWeakestDbm?: number | undefined;
  rssiStrongestDbm?: number | undefined;
  lastRelayOn?: boolean | undefined;
  lastMeasurementSeenUptimeMs?: number | undefined;
  lastPacketSeenUptimeMs?: number | undefined;
  lastMeasurementWallMs?: number | undefined;
  lastPacketWallMs?: number | undefined;
  reasonCounts: Record<string, number>;
  dataStateCounts: Record<string, number>;
  errorCounts: Record<string, number>;
  cycleRequests: number;
  cycleSkips: number;
  cycleErrors: number;
  lastCyclePhase?: CyclePhase | undefined;
  lastCycleReason?: string | undefined;
  cycleOriginalCaptured?: boolean | undefined;
  cycleCleanupOk?: boolean | undefined;
  cycleFinalOffOk?: boolean | undefined;
  cycleScriptStopOk?: boolean | undefined;
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const isEndpointOk = (
  result: EndpointResult | undefined
): result is { ok: true; value: unknown } => result?.ok === true;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. ${USAGE}`);
  }
  return value;
};

const readOptionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

const readIntegerEnv = (
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number => {
  const raw = readOptionalEnv(name);
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

const readOptionalNumberEnv = (
  name: string,
  minimum: number,
  maximum: number
): number | undefined => {
  const raw = readOptionalEnv(name);
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be a number between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

const readBooleanEnv = (name: string, fallback: boolean): boolean => {
  const raw = readOptionalEnv(name)?.toLowerCase();
  if (raw === undefined) {
    return fallback;
  }
  if (['1', 'true', 'yes', 'on'].includes(raw)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(raw)) {
    return false;
  }
  throw new Error(`${name} must be one of: 1, 0, true, false, yes, no, on, off.`);
};

const numberField = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const booleanField = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const stringField = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const recordField = (value: unknown, key: string): JsonRecord | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const field = value[key];
  return isRecord(field) ? field : undefined;
};

const nestedNumberField = (
  value: unknown,
  key: string,
  nestedKey: string
): number | undefined => numberField(recordField(value, key)?.[nestedKey]);

const arrayField = (value: unknown, key: string): unknown[] | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const field = value[key];
  return Array.isArray(field) ? field : undefined;
};

const increment = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const delayOrStop = async (
  durationMs: number,
  stopSignal: Promise<void>
): Promise<void> => {
  await Promise.race([delay(durationMs), stopSignal]);
};

const safeTimestamp = (date = new Date()): string =>
  date.toISOString().replace(/[:.]/g, '-');

const defaultOutFile = (): string =>
  resolve('artifacts', 'hardware', `shelly-soak-${safeTimestamp()}.jsonl`);

const summaryFileFor = (outFile: string): string =>
  outFile.endsWith('.jsonl')
    ? `${outFile.slice(0, -'.jsonl'.length)}.summary.md`
    : `${outFile}.summary.md`;

const fetchJson = async (url: URL, timeoutMs: number): Promise<EndpointResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `${response.status} ${response.statusText}`.trim()
      };
    }
    return { ok: true, value: await response.json() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  } finally {
    clearTimeout(timeout);
  }
};

const endpoint = (baseUrl: URL, path: string): URL => new URL(path, baseUrl);

const collectResponses = async (
  baseUrl: URL,
  scriptId: number,
  timeoutMs: number
): Promise<Record<string, EndpointResult>> => {
  const requests = {
    deviceInfo: endpoint(baseUrl, '/rpc/Shelly.GetDeviceInfo'),
    shellyStatus: endpoint(baseUrl, '/rpc/Shelly.GetStatus'),
    scriptStatus: endpoint(baseUrl, `/rpc/Script.GetStatus?id=${scriptId}`),
    switchStatus: endpoint(baseUrl, '/rpc/Switch.GetStatus?id=0'),
    diag: endpoint(baseUrl, `/script/${scriptId}/diag`)
  };

  const entries = await Promise.all(
    Object.entries(requests).map(async ([key, url]) => [
      key,
      await fetchJson(url, timeoutMs)
    ])
  );
  return Object.fromEntries(entries);
};

const evalScript = async (
  baseUrl: URL,
  scriptId: number,
  code: string,
  timeoutMs: number
): Promise<EndpointResult> => {
  const url = endpoint(
    baseUrl,
    `/rpc/Script.Eval?id=${scriptId}&code=${encodeURIComponent(code)}`
  );
  return fetchJson(url, timeoutMs);
};

const switchOff = async (baseUrl: URL, timeoutMs: number): Promise<EndpointResult> =>
  fetchJson(endpoint(baseUrl, '/rpc/Switch.Set?id=0&on=false'), timeoutMs);

const stopScript = async (
  baseUrl: URL,
  scriptId: number,
  timeoutMs: number
): Promise<EndpointResult> =>
  fetchJson(endpoint(baseUrl, `/rpc/Script.Stop?id=${scriptId}`), timeoutMs);

const numberLiteral = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number literal: ${value}`);
  }
  return String(value);
};

const rounded = (value: number): number => Math.round(value * 100) / 100;

const evalResultString = (result: EndpointResult): string | undefined => {
  if (!result.ok) {
    return undefined;
  }
  return (
    stringField(isRecord(result.value) ? result.value.result : undefined) ??
    (typeof result.value === 'string' ? result.value : undefined)
  );
};

const parseRuntimeConfigSnapshot = (
  result: EndpointResult
): RuntimeConfigSnapshot | undefined => {
  const raw = evalResultString(result);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return undefined;
    }
    const on = numberField(parsed.on);
    const off = numberField(parsed.off);
    const minChangeMs = numberField(parsed.c);
    const consecutiveHits = numberField(parsed.h);
    const maxOnMs = numberField(parsed.x);
    const vpdTargetKpa = numberField(parsed.vp);
    if (
      on === undefined ||
      off === undefined ||
      minChangeMs === undefined ||
      consecutiveHits === undefined ||
      maxOnMs === undefined
    ) {
      return undefined;
    }
    return {
      on,
      off,
      minChangeMs,
      consecutiveHits,
      maxOnMs,
      vpdTargetKpa
    };
  } catch {
    return undefined;
  }
};

const captureRuntimeConfig = async (
  baseUrl: URL,
  scriptId: number,
  timeoutMs: number
): Promise<{ result: EndpointResult; snapshot?: RuntimeConfigSnapshot | undefined }> => {
  const code = 'JSON.stringify({on:C.on,off:C.off,c:C.c,h:C.h,x:C.x,vp:C.vp})';
  const result = await evalScript(baseUrl, scriptId, code, timeoutMs);
  return { result, snapshot: parseRuntimeConfigSnapshot(result) };
};

const cycleMarginFor = (
  metric: RuleMetric,
  configuredMargin: number | undefined
): number => configuredMargin ?? (metric === 'humidity' ? 5 : 1);

const cycleThresholdsFor = (
  parsed: ParsedSample,
  phase: CyclePhase,
  options: CycleOptions
): CycleThresholdPlan | { reason: string } => {
  if (parsed.script.running === false) {
    return { reason: 'script-not-running' };
  }

  const metric = parsed.rule.metric;
  const direction = parsed.rule.direction;
  if (metric === undefined || direction === undefined) {
    return { reason: 'missing-rule-metadata' };
  }

  const controlValue =
    parsed.decision.controlValue ??
    (metric === 'humidity' ? parsed.sensor.humidityPct : parsed.sensor.temperatureC);
  if (controlValue === undefined) {
    return { reason: 'missing-control-value' };
  }

  const margin = cycleMarginFor(metric, options.margin);
  let onThreshold: number;
  let offThreshold: number;

  if (direction === 'below') {
    if (phase === 'on') {
      onThreshold = controlValue + margin;
      offThreshold = controlValue + margin * 2;
    } else {
      onThreshold = controlValue - margin * 2;
      offThreshold = controlValue - margin;
    }
  } else if (phase === 'on') {
    onThreshold = controlValue - margin;
    offThreshold = controlValue - margin * 2;
  } else {
    onThreshold = controlValue + margin * 2;
    offThreshold = controlValue + margin;
  }

  return {
    phase,
    metric,
    direction,
    controlValue: rounded(controlValue),
    margin,
    onThreshold: rounded(onThreshold),
    offThreshold: rounded(offThreshold),
    minChangeMs: options.minChangeMs,
    maxOnMs: options.maxOnMs,
    consecutiveHits: options.consecutiveHits
  };
};

const createCycleEvalCode = (plan: CycleThresholdPlan): string =>
  [
    `C.on=${numberLiteral(plan.onThreshold)}`,
    `C.off=${numberLiteral(plan.offThreshold)}`,
    `C.c=${numberLiteral(plan.minChangeMs)}`,
    `C.h=${numberLiteral(plan.consecutiveHits)}`,
    `C.x=${numberLiteral(plan.maxOnMs)}`,
    'R.lc=0',
    'R.nh=0',
    'R.fh=0',
    JSON.stringify(`soak-cycle-${plan.phase}`)
  ].join(';');

const shouldCycleNow = (
  state: CycleState,
  options: CycleOptions,
  nowMs: number
): boolean =>
  options.enabled &&
  (state.lastAtMs === undefined || nowMs - state.lastAtMs >= options.periodMs);

const oppositePhase = (phase: CyclePhase): CyclePhase => (phase === 'on' ? 'off' : 'on');

const maybeCycleRelayThresholds = async (options: {
  shellyUrl: URL;
  scriptId: number;
  timeoutMs: number;
  outFile: string;
  sampledAtMs: number;
  startedAtMs: number;
  parsed: ParsedSample;
  cycleOptions: CycleOptions;
  cycleState: CycleState;
  summary: SummaryState;
}): Promise<void> => {
  const {
    shellyUrl,
    scriptId,
    timeoutMs,
    outFile,
    sampledAtMs,
    startedAtMs,
    parsed,
    cycleOptions,
    cycleState,
    summary
  } = options;

  if (!shouldCycleNow(cycleState, cycleOptions, sampledAtMs)) {
    return;
  }

  const plan = cycleThresholdsFor(parsed, cycleState.nextPhase, cycleOptions);
  if ('reason' in plan) {
    cycleState.skips += 1;
    cycleState.lastReason = plan.reason;
    summary.cycleSkips = cycleState.skips;
    summary.lastCycleReason = plan.reason;
    await writeJsonLine(outFile, {
      type: 'cycle-skip',
      schemaVersion: 1,
      sampledAt: new Date(sampledAtMs).toISOString(),
      elapsedMs: sampledAtMs - startedAtMs,
      phase: cycleState.nextPhase,
      reason: plan.reason
    });
    return;
  }

  if (cycleState.originalConfig === undefined) {
    const capture = await captureRuntimeConfig(shellyUrl, scriptId, timeoutMs);
    if (capture.snapshot === undefined) {
      cycleState.errors += 1;
      cycleState.lastReason = 'original-config-capture-failed';
      summary.cycleErrors = cycleState.errors;
      summary.lastCycleReason = cycleState.lastReason;
      await writeJsonLine(outFile, {
        type: 'cycle-capture-error',
        schemaVersion: 1,
        sampledAt: new Date(sampledAtMs).toISOString(),
        elapsedMs: sampledAtMs - startedAtMs,
        result: capture.result
      });
      return;
    }
    cycleState.originalConfig = capture.snapshot;
    summary.cycleOriginalCaptured = true;
    await writeJsonLine(outFile, {
      type: 'cycle-original-config',
      schemaVersion: 1,
      sampledAt: new Date(sampledAtMs).toISOString(),
      elapsedMs: sampledAtMs - startedAtMs,
      config: capture.snapshot
    });
  }

  cycleState.requests += 1;
  cycleState.lastAtMs = sampledAtMs;
  cycleState.lastPhase = plan.phase;
  summary.cycleRequests = cycleState.requests;
  summary.lastCyclePhase = plan.phase;

  const code = createCycleEvalCode(plan);
  const result = await evalScript(shellyUrl, scriptId, code, timeoutMs);
  if (!result.ok) {
    cycleState.errors += 1;
    summary.cycleErrors = cycleState.errors;
    cycleState.lastReason = result.error;
    summary.lastCycleReason = result.error;
  } else {
    cycleState.nextPhase = oppositePhase(plan.phase);
    cycleState.lastReason = 'thresholds-updated';
    summary.lastCycleReason = 'thresholds-updated';
  }

  await writeJsonLine(outFile, {
    type: 'cycle',
    schemaVersion: 1,
    sampledAt: new Date(sampledAtMs).toISOString(),
    elapsedMs: sampledAtMs - startedAtMs,
    ok: result.ok,
    plan,
    evalCode: code,
    result
  });
};

const createRestoreEvalCode = (
  snapshot: RuntimeConfigSnapshot,
  finalOff: boolean
): string =>
  [
    `C.on=${numberLiteral(snapshot.on)}`,
    `C.off=${numberLiteral(snapshot.off)}`,
    `C.c=${numberLiteral(snapshot.minChangeMs)}`,
    `C.h=${numberLiteral(snapshot.consecutiveHits)}`,
    `C.x=${numberLiteral(snapshot.maxOnMs)}`,
    snapshot.vpdTargetKpa === undefined
      ? undefined
      : `C.vp=${numberLiteral(snapshot.vpdTargetKpa)}`,
    'R.lc=0',
    'R.nh=0',
    'R.fh=0',
    finalOff ? 'sw(false,"soak-final-off",true)' : undefined,
    JSON.stringify(finalOff ? 'soak-restored-final-off' : 'soak-restored')
  ]
    .filter((part): part is string => part !== undefined)
    .join(';');

const cleanupCycleRuntime = async (options: {
  shellyUrl: URL;
  scriptId: number;
  timeoutMs: number;
  outFile: string;
  cycleOptions: CycleOptions;
  cycleState: CycleState;
  summary: SummaryState;
}): Promise<void> => {
  const { shellyUrl, scriptId, timeoutMs, outFile, cycleOptions, cycleState, summary } =
    options;
  if (!cycleOptions.enabled) {
    return;
  }

  const cleanup: JsonRecord = {
    restored: false,
    scriptStopped: false,
    finalOff: false
  };

  if (cycleOptions.stopScriptOnFinish) {
    const stop = await stopScript(shellyUrl, scriptId, timeoutMs);
    cleanup.scriptStop = stop;
    cleanup.scriptStopped = stop.ok;
    summary.cycleScriptStopOk = stop.ok;
    summary.cycleCleanupOk = stop.ok;
    if (!stop.ok) {
      increment(summary.errorCounts, `cycle-script-stop: ${stop.error}`);
      if (cycleState.originalConfig !== undefined) {
        const restore = await evalScript(
          shellyUrl,
          scriptId,
          createRestoreEvalCode(cycleState.originalConfig, cycleOptions.finalOff),
          timeoutMs
        );
        cleanup.restore = restore;
        cleanup.restored = restore.ok;
        summary.cycleCleanupOk = restore.ok;
      }
    }
  } else if (cycleState.originalConfig !== undefined) {
    const restore = await evalScript(
      shellyUrl,
      scriptId,
      createRestoreEvalCode(cycleState.originalConfig, cycleOptions.finalOff),
      timeoutMs
    );
    cleanup.restore = restore;
    cleanup.restored = restore.ok;
    summary.cycleCleanupOk = restore.ok;
    if (!restore.ok) {
      increment(summary.errorCounts, `cycle-cleanup: ${restore.error}`);
    }
    if (cycleOptions.finalOff) {
      await delay(500);
    }
  }

  if (cycleOptions.finalOff) {
    const finalOff = await switchOff(shellyUrl, timeoutMs);
    cleanup.finalOffResult = finalOff;
    cleanup.finalOff = finalOff.ok;
    summary.cycleFinalOffOk = finalOff.ok;
    if (!finalOff.ok) {
      increment(summary.errorCounts, `cycle-final-off: ${finalOff.error}`);
    }
  }

  await writeJsonLine(outFile, {
    type: 'cycle-cleanup',
    schemaVersion: 1,
    finishedAt: new Date().toISOString(),
    cleanup
  });
};

const parseDiag = (diag: unknown): Partial<ParsedSample> => {
  if (!isRecord(diag)) {
    return {};
  }

  const sensorMeta = arrayField(diag, 's');
  const ruleMeta = arrayField(diag, 'q');
  const timeMeta = arrayField(diag, 'y');
  const plugMeta = arrayField(diag, 'p');
  const runtime = arrayField(diag, 'g');
  const metricCode = numberField(ruleMeta?.[0]);
  const directionCode = numberField(ruleMeta?.[1]);

  return {
    device: {
      uptimeSec: numberField(timeMeta?.[2])
    },
    relay: {
      diagOn: booleanField(plugMeta?.[0]),
      powerW: numberField(plugMeta?.[1]),
      voltageV: numberField(plugMeta?.[2]),
      currentA: numberField(plugMeta?.[3]),
      energyWh: numberField(plugMeta?.[4]),
      deviceTemperatureC: numberField(plugMeta?.[5])
    },
    sensor: {
      runtimeAddress: stringField(sensorMeta?.[0]),
      displayName: stringField(sensorMeta?.[1]),
      lastSeenUptimeMs: numberField(runtime?.[0]),
      lastPacketSeenUptimeMs: numberField(runtime?.[15]),
      temperatureC: numberField(runtime?.[1]),
      humidityPct: numberField(runtime?.[2]),
      batteryPct: numberField(runtime?.[3]),
      rssiDbm: numberField(runtime?.[4])
    },
    rule: {
      metric:
        metricCode === 1 ? 'humidity' : metricCode === 0 ? 'temperature' : undefined,
      direction:
        directionCode === 1 ? 'above' : directionCode === 0 ? 'below' : undefined,
      onThreshold: numberField(ruleMeta?.[2]),
      offThreshold: numberField(ruleMeta?.[3]),
      staleTimeoutSec: numberField(ruleMeta?.[4]),
      rssiMin: numberField(ruleMeta?.[5]),
      scriptHash: stringField(diag.z)
    },
    decision: {
      reason: stringField(runtime?.[6]),
      dataState: stringField(runtime?.[16]),
      lastChangeUptimeMs: numberField(runtime?.[7]),
      onStartedUptimeMs: numberField(runtime?.[8]),
      onHits: numberField(runtime?.[9]),
      offHits: numberField(runtime?.[10]),
      controlValue: numberField(runtime?.[11]),
      vpdKpa: numberField(runtime?.[12]),
      effectiveOnThreshold: numberField(runtime?.[13]),
      effectiveOffThreshold: numberField(runtime?.[14])
    }
  };
};

const parseSample = (
  responses: Record<string, EndpointResult>,
  scriptId: number
): ParsedSample => {
  const deviceInfo = isEndpointOk(responses.deviceInfo)
    ? responses.deviceInfo.value
    : undefined;
  const shellyStatus = isEndpointOk(responses.shellyStatus)
    ? responses.shellyStatus.value
    : undefined;
  const scriptStatus = isEndpointOk(responses.scriptStatus)
    ? responses.scriptStatus.value
    : undefined;
  const switchStatus = isEndpointOk(responses.switchStatus)
    ? responses.switchStatus.value
    : undefined;
  const diag = isEndpointOk(responses.diag) ? responses.diag.value : undefined;
  const diagParsed = parseDiag(diag);
  const sysStatus = recordField(shellyStatus, 'sys');
  const wifiStatus = recordField(shellyStatus, 'wifi');

  const parsed: ParsedSample = {
    device: {
      ...diagParsed.device,
      model: stringField(isRecord(deviceInfo) ? deviceInfo.model : undefined),
      firmwareId:
        stringField(isRecord(deviceInfo) ? deviceInfo.fw_id : undefined) ??
        stringField(isRecord(deviceInfo) ? deviceInfo.ver : undefined),
      uptimeSec:
        numberField(sysStatus?.uptime) ??
        numberField(isRecord(sysStatus) ? sysStatus.uptime : undefined) ??
        diagParsed.device?.uptimeSec,
      wifiRssiDbm: numberField(wifiStatus?.rssi)
    },
    script: {
      id: scriptId,
      running: booleanField(isRecord(scriptStatus) ? scriptStatus.running : undefined),
      memUsed: numberField(isRecord(scriptStatus) ? scriptStatus.mem_used : undefined),
      memPeak: numberField(isRecord(scriptStatus) ? scriptStatus.mem_peak : undefined),
      memFree: numberField(isRecord(scriptStatus) ? scriptStatus.mem_free : undefined),
      errors: Array.isArray(isRecord(scriptStatus) ? scriptStatus.errors : undefined)
        ? (scriptStatus as { errors: unknown[] }).errors
        : undefined
    },
    relay: {
      ...diagParsed.relay,
      rpcOn:
        booleanField(isRecord(switchStatus) ? switchStatus.output : undefined) ??
        booleanField(recordField(shellyStatus, 'switch:0')?.output),
      powerW:
        numberField(isRecord(switchStatus) ? switchStatus.apower : undefined) ??
        diagParsed.relay?.powerW,
      voltageV:
        numberField(isRecord(switchStatus) ? switchStatus.voltage : undefined) ??
        diagParsed.relay?.voltageV,
      currentA:
        numberField(isRecord(switchStatus) ? switchStatus.current : undefined) ??
        diagParsed.relay?.currentA,
      energyWh:
        nestedNumberField(switchStatus, 'aenergy', 'total') ?? diagParsed.relay?.energyWh,
      deviceTemperatureC:
        nestedNumberField(switchStatus, 'temperature', 'tC') ??
        diagParsed.relay?.deviceTemperatureC
    },
    sensor: {
      ...diagParsed.sensor
    },
    rule: {
      ...diagParsed.rule
    },
    decision: {
      ...diagParsed.decision
    }
  };

  const uptimeMs = parsed.device.uptimeSec ? parsed.device.uptimeSec * 1000 : undefined;
  if (uptimeMs !== undefined && parsed.sensor.lastSeenUptimeMs !== undefined) {
    parsed.sensor.ageSinceMeasurementMs = Math.max(
      0,
      uptimeMs - parsed.sensor.lastSeenUptimeMs
    );
  }
  if (uptimeMs !== undefined && parsed.sensor.lastPacketSeenUptimeMs !== undefined) {
    parsed.sensor.ageSincePacketMs = Math.max(
      0,
      uptimeMs - parsed.sensor.lastPacketSeenUptimeMs
    );
  }

  return parsed;
};

const updateMin = (current: number | undefined, value: number): number =>
  current === undefined ? value : Math.min(current, value);

const updateMax = (current: number | undefined, value: number): number =>
  current === undefined ? value : Math.max(current, value);

const updateSummary = (
  summary: SummaryState,
  sampledAtMs: number,
  sampleOk: boolean,
  responses: Record<string, EndpointResult>,
  parsed: ParsedSample
): void => {
  summary.samples += 1;
  if (sampleOk) {
    summary.okSamples += 1;
  } else {
    summary.failedSamples += 1;
  }

  for (const [key, result] of Object.entries(responses)) {
    if (!result.ok) {
      increment(summary.errorCounts, `${key}: ${result.error}`);
      if (key === 'diag') {
        summary.diagFailures += 1;
      } else {
        summary.rpcFailures += 1;
      }
    }
  }

  if (parsed.script.running === false) {
    summary.scriptNotRunningSamples += 1;
  }
  if (parsed.relay.rpcOn !== undefined && parsed.relay.rpcOn !== summary.lastRelayOn) {
    if (summary.lastRelayOn !== undefined) {
      summary.relayChanges += 1;
    }
    summary.lastRelayOn = parsed.relay.rpcOn;
  }

  if (parsed.decision.reason) {
    increment(summary.reasonCounts, parsed.decision.reason);
  }
  if (parsed.decision.dataState) {
    increment(summary.dataStateCounts, parsed.decision.dataState);
  }
  if (parsed.script.memUsed !== undefined) {
    summary.memUsedMax = updateMax(summary.memUsedMax, parsed.script.memUsed);
  }
  if (parsed.script.memPeak !== undefined) {
    summary.memPeakMax = updateMax(summary.memPeakMax, parsed.script.memPeak);
  }
  if (parsed.script.memFree !== undefined) {
    summary.memFreeMin = updateMin(summary.memFreeMin, parsed.script.memFree);
  }
  if (parsed.sensor.rssiDbm !== undefined) {
    summary.rssiWeakestDbm = updateMin(summary.rssiWeakestDbm, parsed.sensor.rssiDbm);
    summary.rssiStrongestDbm = updateMax(summary.rssiStrongestDbm, parsed.sensor.rssiDbm);
  }

  if (parsed.sensor.lastSeenUptimeMs !== undefined) {
    summary.samplesWithMeasurement += 1;
    if (parsed.sensor.lastSeenUptimeMs !== summary.lastMeasurementSeenUptimeMs) {
      if (summary.lastMeasurementWallMs !== undefined) {
        summary.maxNoMeasurementUpdateMs = Math.max(
          summary.maxNoMeasurementUpdateMs,
          sampledAtMs - summary.lastMeasurementWallMs
        );
      }
      summary.lastMeasurementSeenUptimeMs = parsed.sensor.lastSeenUptimeMs;
      summary.lastMeasurementWallMs = sampledAtMs;
    } else if (summary.lastMeasurementWallMs !== undefined) {
      summary.maxNoMeasurementUpdateMs = Math.max(
        summary.maxNoMeasurementUpdateMs,
        sampledAtMs - summary.lastMeasurementWallMs
      );
    }
  }

  if (parsed.sensor.lastPacketSeenUptimeMs !== undefined) {
    summary.samplesWithPacket += 1;
    if (parsed.sensor.lastPacketSeenUptimeMs !== summary.lastPacketSeenUptimeMs) {
      if (summary.lastPacketWallMs !== undefined) {
        summary.maxNoPacketUpdateMs = Math.max(
          summary.maxNoPacketUpdateMs,
          sampledAtMs - summary.lastPacketWallMs
        );
      }
      summary.lastPacketSeenUptimeMs = parsed.sensor.lastPacketSeenUptimeMs;
      summary.lastPacketWallMs = sampledAtMs;
    } else if (summary.lastPacketWallMs !== undefined) {
      summary.maxNoPacketUpdateMs = Math.max(
        summary.maxNoPacketUpdateMs,
        sampledAtMs - summary.lastPacketWallMs
      );
    }
  }
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const formatValue = (value: unknown): string =>
  value === undefined ? 'brak' : String(value);

const markdownTable = (rows: readonly [string, unknown][]): string =>
  [
    '| Metryka | Wartość |',
    '| --- | --- |',
    ...rows.map(([k, v]) => `| ${k} | ${formatValue(v)} |`)
  ].join('\n');

const countTable = (title: string, counts: Record<string, number>): string => {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return `## ${title}\n\nBrak.\n`;
  }
  return `## ${title}\n\n${markdownTable(entries)}\n`;
};

const createSummaryMarkdown = (options: {
  summary: SummaryState;
  shellyUrl: string;
  scriptId: number;
  outFile: string;
  summaryFile: string;
  intervalMs: number;
  cycleOptions: CycleOptions;
}): string => {
  const { summary } = options;
  const startedAtMs = Date.parse(summary.startedAtIso);
  const finishedAtIso = summary.finishedAtIso ?? new Date().toISOString();
  const finishedAtMs = Date.parse(finishedAtIso);
  const durationMs = Number.isFinite(startedAtMs) ? finishedAtMs - startedAtMs : 0;

  const rows: [string, unknown][] = [
    ['Start', summary.startedAtIso],
    ['Koniec', finishedAtIso],
    ['Czas trwania', formatDuration(Math.max(0, durationMs))],
    ['Powód zatrzymania', summary.stopReason],
    ['Shelly URL', options.shellyUrl],
    ['Script ID', options.scriptId],
    ['Interwał próbkowania', `${options.intervalMs} ms`],
    ['Cykliczne progi ON/OFF', options.cycleOptions.enabled ? 'włączone' : 'wyłączone'],
    ['Okres zmiany progów', `${options.cycleOptions.periodMs} ms`],
    ['Margines progów', options.cycleOptions.margin],
    ['Testowy minChangeMs', options.cycleOptions.minChangeMs],
    ['Testowy maxOnMs', options.cycleOptions.maxOnMs],
    ['Testowe consecutiveHits', options.cycleOptions.consecutiveHits],
    ['Final OFF po cyklu', options.cycleOptions.finalOff ? 'włączone' : 'wyłączone'],
    [
      'Stop skryptu po cyklu',
      options.cycleOptions.stopScriptOnFinish ? 'włączone' : 'wyłączone'
    ],
    ['Próby zmiany progów', summary.cycleRequests],
    ['Pominięte zmiany progów', summary.cycleSkips],
    ['Błędy zmiany progów', summary.cycleErrors],
    ['Ostatnia faza progów', summary.lastCyclePhase],
    ['Ostatni wynik progów', summary.lastCycleReason],
    ['Oryginalna konfiguracja zapisana', summary.cycleOriginalCaptured],
    ['Sprzątanie konfiguracji OK', summary.cycleCleanupOk],
    ['Stop skryptu OK', summary.cycleScriptStopOk],
    ['Końcowe OFF OK', summary.cycleFinalOffOk],
    ['Próbki', summary.samples],
    ['Próbki OK', summary.okSamples],
    ['Próbki z błędem', summary.failedSamples],
    ['Błędy /diag', summary.diagFailures],
    ['Błędy RPC', summary.rpcFailures],
    ['Próbki: skrypt nie działał', summary.scriptNotRunningSamples],
    ['Zmiany przekaźnika', summary.relayChanges],
    ['Próbki z pełnym pomiarem', summary.samplesWithMeasurement],
    ['Próbki z pakietem targetu', summary.samplesWithPacket],
    [
      'Najdłużej bez nowego pełnego pomiaru',
      formatDuration(summary.maxNoMeasurementUpdateMs)
    ],
    ['Najdłużej bez nowego pakietu targetu', formatDuration(summary.maxNoPacketUpdateMs)],
    ['Maks. mem_used', summary.memUsedMax],
    ['Maks. mem_peak', summary.memPeakMax],
    ['Min. mem_free', summary.memFreeMin],
    ['Najsłabszy RSSI', summary.rssiWeakestDbm],
    ['Najmocniejszy RSSI', summary.rssiStrongestDbm],
    ['JSONL', options.outFile],
    ['Raport', options.summaryFile]
  ];

  return [
    '# Shelly soak report',
    '',
    markdownTable(rows),
    '',
    countTable('Powody decyzji runtime', summary.reasonCounts),
    countTable('Stany danych BLE', summary.dataStateCounts),
    countTable('Błędy endpointów', summary.errorCounts)
  ].join('\n');
};

const writeJsonLine = async (path: string, value: unknown): Promise<void> => {
  await appendFile(path, `${JSON.stringify(value)}\n`, 'utf8');
};

const main = async (): Promise<void> => {
  const shellyUrl = new URL(readRequiredEnv('SHELLY_URL'));
  const scriptId = readIntegerEnv('SCRIPT_ID', 1, 0, 20);
  const intervalMs = readIntegerEnv('SOAK_INTERVAL_MS', 5000, 1000, 600000);
  const timeoutMs = readIntegerEnv('SOAK_RPC_TIMEOUT_MS', 4000, 500, 60000);
  const durationMs = readIntegerEnv('SOAK_DURATION_MS', 0, 0, 7 * 24 * 60 * 60 * 1000);
  const cycleEnabled = readBooleanEnv('SOAK_CYCLE_RELAY', false);
  const cyclePeriodMs = readIntegerEnv(
    'SOAK_CYCLE_PERIOD_MS',
    120000,
    10000,
    60 * 60 * 1000
  );
  const cycleOptions: CycleOptions = {
    enabled: cycleEnabled,
    periodMs: cyclePeriodMs,
    margin: readOptionalNumberEnv('SOAK_CYCLE_MARGIN', 0.01, 100),
    minChangeMs: readIntegerEnv('SOAK_CYCLE_MIN_CHANGE_MS', 1000, 0, 60 * 60 * 1000),
    maxOnMs: readIntegerEnv(
      'SOAK_CYCLE_MAX_ON_MS',
      cyclePeriodMs + 60000,
      1000,
      7 * 24 * 60 * 60 * 1000
    ),
    consecutiveHits: readIntegerEnv('SOAK_CYCLE_CONSECUTIVE_HITS', 1, 1, 10),
    finalOff: readBooleanEnv('SOAK_FINAL_OFF', cycleEnabled),
    stopScriptOnFinish: readBooleanEnv('SOAK_STOP_SCRIPT_ON_FINISH', cycleEnabled)
  };
  const outFile = resolve(readOptionalEnv('SOAK_OUT_FILE') ?? defaultOutFile());
  const summaryFile = resolve(
    readOptionalEnv('SOAK_SUMMARY_FILE') ?? summaryFileFor(outFile)
  );
  const startedAtMs = Date.now();
  const deadlineMs = durationMs > 0 ? startedAtMs + durationMs : null;
  const summary: SummaryState = {
    startedAtIso: new Date(startedAtMs).toISOString(),
    samples: 0,
    okSamples: 0,
    failedSamples: 0,
    diagFailures: 0,
    rpcFailures: 0,
    scriptNotRunningSamples: 0,
    relayChanges: 0,
    samplesWithMeasurement: 0,
    samplesWithPacket: 0,
    maxNoMeasurementUpdateMs: 0,
    maxNoPacketUpdateMs: 0,
    reasonCounts: {},
    dataStateCounts: {},
    errorCounts: {},
    cycleRequests: 0,
    cycleSkips: 0,
    cycleErrors: 0
  };
  const cycleState: CycleState = {
    nextPhase: 'on',
    requests: 0,
    skips: 0,
    errors: 0
  };

  await mkdir(dirname(outFile), { recursive: true });
  await mkdir(dirname(summaryFile), { recursive: true });
  await writeFile(outFile, '', 'utf8');

  let stopRequested = false;
  let stopReason = durationMs > 0 ? 'duration' : 'manual';
  let resolveStopSignal: (() => void) | undefined;
  const stopSignal = new Promise<void>((resolveStop) => {
    resolveStopSignal = resolveStop;
  });
  const requestStop = (reason: string): void => {
    if (!stopRequested) {
      stopRequested = true;
      stopReason = reason;
      resolveStopSignal?.();
    }
  };

  process.once('SIGINT', () => requestStop('SIGINT'));
  process.once('SIGTERM', () => requestStop('SIGTERM'));

  await writeJsonLine(outFile, {
    type: 'start',
    schemaVersion: 1,
    startedAt: summary.startedAtIso,
    shellyUrl: shellyUrl.toString(),
    scriptId,
    intervalMs,
    timeoutMs,
    durationMs: durationMs || null,
    cycleOptions
  });

  console.log(`Shelly soak logger started`);
  console.log(`JSONL: ${outFile}`);
  console.log(`Summary: ${summaryFile}`);
  if (cycleOptions.enabled) {
    console.log(
      [
        `Cycle: enabled`,
        `period=${cycleOptions.periodMs}ms`,
        `margin=${cycleOptions.margin ?? 'auto'}`,
        `minChange=${cycleOptions.minChangeMs}ms`,
        `maxOn=${cycleOptions.maxOnMs}ms`,
        `finalOff=${String(cycleOptions.finalOff)}`,
        `stopScript=${String(cycleOptions.stopScriptOnFinish)}`,
        `hits=${cycleOptions.consecutiveHits}`
      ].join(' ')
    );
  }

  let sequence = 0;
  try {
    while (
      !stopRequested &&
      (sequence === 0 || deadlineMs === null || Date.now() < deadlineMs)
    ) {
      sequence += 1;
      const sampledAtMs = Date.now();
      const responses = await collectResponses(shellyUrl, scriptId, timeoutMs);
      const parsed = parseSample(responses, scriptId);
      const sampleOk = Object.values(responses).every((response) => response.ok);
      updateSummary(summary, sampledAtMs, sampleOk, responses, parsed);

      await writeJsonLine(outFile, {
        type: 'sample',
        schemaVersion: 1,
        sequence,
        sampledAt: new Date(sampledAtMs).toISOString(),
        elapsedMs: sampledAtMs - startedAtMs,
        ok: sampleOk,
        parsed,
        responses
      });

      await maybeCycleRelayThresholds({
        shellyUrl,
        scriptId,
        timeoutMs,
        outFile,
        sampledAtMs,
        startedAtMs,
        parsed,
        cycleOptions,
        cycleState,
        summary
      });

      const reason = parsed.decision.reason ?? 'brak';
      const dataState = parsed.decision.dataState ?? 'brak';
      const relay = parsed.relay.rpcOn ?? parsed.relay.diagOn;
      const age = parsed.sensor.ageSinceMeasurementMs;
      console.log(
        [
          `#${sequence}`,
          `reason=${reason}`,
          `data=${dataState}`,
          `relay=${relay === undefined ? '?' : relay ? 'ON' : 'OFF'}`,
          `temp=${formatValue(parsed.sensor.temperatureC)}`,
          `hum=${formatValue(parsed.sensor.humidityPct)}`,
          `rssi=${formatValue(parsed.sensor.rssiDbm)}`,
          `age=${age === undefined ? 'brak' : `${Math.round(age / 1000)}s`}`,
          `mem=${formatValue(parsed.script.memUsed)}/${formatValue(parsed.script.memFree)}`
        ].join(' ')
      );

      if (deadlineMs !== null && Date.now() >= deadlineMs) {
        break;
      }
      const waitMs =
        deadlineMs === null
          ? intervalMs
          : Math.max(0, Math.min(intervalMs, deadlineMs - Date.now()));
      if (waitMs > 0) {
        await delayOrStop(waitMs, stopSignal);
      }
    }
  } catch (error) {
    process.exitCode = 1;
    stopReason = `error: ${errorMessage(error)}`;
    increment(summary.errorCounts, stopReason);
  } finally {
    summary.finishedAtIso = new Date().toISOString();
    summary.stopReason = stopReason;
    await cleanupCycleRuntime({
      shellyUrl,
      scriptId,
      timeoutMs,
      outFile,
      cycleOptions,
      cycleState,
      summary
    });
    const summaryMarkdown = createSummaryMarkdown({
      summary,
      shellyUrl: shellyUrl.toString(),
      scriptId,
      outFile,
      summaryFile,
      intervalMs,
      cycleOptions
    });
    await writeFile(summaryFile, summaryMarkdown, 'utf8');
    await writeJsonLine(outFile, {
      type: 'summary',
      schemaVersion: 1,
      finishedAt: summary.finishedAtIso,
      summary
    });
    console.log(`Shelly soak logger stopped: ${stopReason}`);
    console.log(`JSONL: ${outFile}`);
    console.log(`Summary: ${summaryFile}`);
  }
};

await main();
