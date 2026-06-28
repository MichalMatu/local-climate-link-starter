import {
  calculateVpdKpa,
  type RuleControlMetric,
  type RulePresetId,
  type ThresholdDirection
} from '@lcl/automation-core';
import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import {
  FetchShellyRpcTransport,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  RpcShellyClient,
  type Result,
  type ShellyClientError,
  type ShellyRpcTransport
} from '@lcl/shelly-client';

type SensorProfileId = ShellyThermostatConfig['sensor']['profileId'];

interface SensorUnderTest {
  profileId: SensorProfileId;
  runtimeAddress: string;
  displayName: string;
}

interface ModeSpec {
  mode: RulePresetId;
  metric: RuleControlMetric;
  direction: ThresholdDirection;
  onReason: 'below-threshold' | 'above-threshold';
  offReason: 'below-threshold' | 'above-threshold';
}

interface MeasurementSnapshot {
  temperatureC: number;
  humidityPct: number;
  batteryPct?: number | undefined;
  rssi?: number | undefined;
  lastSeen: number;
}

interface ParsedDiag {
  raw: unknown;
  measurement?: MeasurementSnapshot | undefined;
  relayState?: boolean | undefined;
  lastReason?: string | undefined;
  lastControlValue?: number | undefined;
}

interface PhaseResult {
  diag: ParsedDiag;
  relayOn: boolean;
  attempts: number;
}

interface MatrixResult {
  sensor: string;
  mode: RulePresetId;
  vpdAssist: boolean;
  scriptId?: number | undefined;
  scriptBytes?: number | undefined;
  on?: PhaseResult | undefined;
  off?: PhaseResult | undefined;
  evalResult?: unknown;
  ok: boolean;
  error?: string | undefined;
}

const USAGE =
  'Usage: SHELLY_URL=http://<shelly-ip> XIAOMI_MAC=<mac> TP357_MAC=<mac> pnpm hardware:shelly:matrix';

const modes: ModeSpec[] = [
  {
    mode: 'heating',
    metric: 'temperature',
    direction: 'below',
    onReason: 'below-threshold',
    offReason: 'above-threshold'
  },
  {
    mode: 'cooling',
    metric: 'temperature',
    direction: 'above',
    onReason: 'above-threshold',
    offReason: 'below-threshold'
  },
  {
    mode: 'humidifying',
    metric: 'humidity',
    direction: 'below',
    onReason: 'below-threshold',
    offReason: 'above-threshold'
  },
  {
    mode: 'dehumidifying',
    metric: 'humidity',
    direction: 'above',
    onReason: 'above-threshold',
    offReason: 'below-threshold'
  }
];

const vpdOptions = [false, true] as const;

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. ${USAGE}`);
  }
  return value;
};

const readIntegerEnv = (
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number => {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

const normalizeMacAddress = (value: string): string => {
  const compact = value.trim().replace(/[:-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) {
    throw new Error('BLE MAC must be a 6-byte address.');
  }

  const pairs = compact.match(/[0-9A-F]{2}/g);
  if (!pairs || pairs.length !== 6) {
    throw new Error('BLE MAC must contain exactly 6 bytes.');
  }
  return pairs.join(':');
};

const numericField = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const parseDiag = (raw: unknown): ParsedDiag => {
  if (!isRecord(raw) || !isRecord(raw.g)) {
    return { raw };
  }

  const diagnostics = raw.g;
  const temperatureC = numericField(diagnostics.t);
  const humidityPct = numericField(diagnostics.h);
  const lastSeen = numericField(diagnostics.ls);
  const measurement =
    temperatureC !== undefined && humidityPct !== undefined && lastSeen !== undefined
      ? {
          temperatureC,
          humidityPct,
          batteryPct: numericField(diagnostics.b),
          rssi: numericField(diagnostics.r),
          lastSeen
        }
      : undefined;

  return {
    raw,
    measurement,
    relayState: typeof diagnostics.on === 'boolean' ? diagnostics.on : undefined,
    lastReason: typeof diagnostics.rs === 'string' ? diagnostics.rs : undefined,
    lastControlValue: numericField(diagnostics.cv)
  };
};

const fetchJson = async (
  url: URL,
  timeoutMs: number
): Promise<
  { ok: true; value: unknown } | { ok: false; error: string; status?: number }
> => {
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

const rpcValueOrThrow = async <T>(
  result: Promise<Result<T, ShellyClientError>>,
  label: string
): Promise<T> => {
  const resolved = await result;
  if (resolved.ok) {
    return resolved.value;
  }
  throw new Error(`${label}: ${resolved.error.technicalMessage ?? resolved.error.kind}`);
};

const rpcResultToJson = <T>(result: Result<T, ShellyClientError>): unknown =>
  result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error };

const switchRelayOn = async (
  transport: ShellyRpcTransport,
  timeoutMs: number
): Promise<boolean> => {
  const status = await transport.call<unknown>(
    { method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } },
    { timeoutMs }
  );
  if (!status.ok || !isRecord(status.value)) {
    return false;
  }
  return status.value.output === true;
};

const saturationVaporPressureKpa = (temperatureC: number): number =>
  0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));

const targetKpaForMetric = (
  metric: RuleControlMetric,
  targetControlValue: number,
  measurement: MeasurementSnapshot
): number => {
  const target =
    metric === 'temperature'
      ? calculateVpdKpa(targetControlValue, measurement.humidityPct)
      : saturationVaporPressureKpa(measurement.temperatureC) *
        (1 - targetControlValue / 100);

  if (target === undefined || !Number.isFinite(target) || target <= 0 || target > 5) {
    throw new Error(
      `Cannot derive safe VPD target for ${metric} target ${targetControlValue}.`
    );
  }
  return target;
};

const controlValue = (spec: ModeSpec, measurement: MeasurementSnapshot): number =>
  spec.metric === 'temperature' ? measurement.temperatureC : measurement.humidityPct;

const createThresholds = (
  spec: ModeSpec,
  measurement: MeasurementSnapshot,
  phase: 'on' | 'off',
  vpdAssist: boolean
): { onThreshold: number; offThreshold: number; vpdTargetKpa: number } => {
  const value = controlValue(spec, measurement);
  const scriptMargin = spec.metric === 'temperature' ? 0.25 : 2;
  const staticDelta = spec.metric === 'temperature' ? 1.2 : 8;
  const vpdDelta = spec.metric === 'temperature' ? 1.5 : 10;

  if (!vpdAssist) {
    if (spec.direction === 'below') {
      return phase === 'on'
        ? {
            onThreshold: value + staticDelta,
            offThreshold: value + staticDelta * 2,
            vpdTargetKpa: 1.2
          }
        : {
            onThreshold: value - staticDelta * 2,
            offThreshold: value - staticDelta,
            vpdTargetKpa: 1.2
          };
    }

    return phase === 'on'
      ? {
          onThreshold: value - staticDelta,
          offThreshold: value - staticDelta * 2,
          vpdTargetKpa: 1.2
        }
      : {
          onThreshold: value + staticDelta * 2,
          offThreshold: value + staticDelta,
          vpdTargetKpa: 1.2
        };
  }

  const targetControlValue =
    spec.direction === 'below'
      ? phase === 'on'
        ? value + vpdDelta
        : value - vpdDelta
      : phase === 'on'
        ? value - vpdDelta
        : value + vpdDelta;
  const vpdTargetKpa = targetKpaForMetric(spec.metric, targetControlValue, measurement);

  return spec.direction === 'below'
    ? {
        onThreshold: targetControlValue - scriptMargin,
        offThreshold: targetControlValue + scriptMargin,
        vpdTargetKpa
      }
    : {
        onThreshold: targetControlValue + scriptMargin,
        offThreshold: targetControlValue - scriptMargin,
        vpdTargetKpa
      };
};

const numberLiteral = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot encode non-finite number ${value}.`);
  }
  return Number(value.toFixed(4)).toString();
};

const createConfig = (
  sensor: SensorUnderTest,
  spec: ModeSpec,
  thresholds: { onThreshold: number; offThreshold: number; vpdTargetKpa: number },
  vpdAssist: boolean
): ShellyThermostatConfig => {
  const base = createDefaultShellyThermostatConfig(sensor.profileId, spec.mode);

  return {
    ...base,
    sensor: {
      ...base.sensor,
      sensorId: `${sensor.profileId}-${sensor.runtimeAddress.replace(/:/g, '')}`,
      runtimeAddress: sensor.runtimeAddress,
      displayName: sensor.displayName,
      parserValidated: true
    },
    rule: {
      ...base.rule,
      control: {
        metric: spec.metric,
        direction: spec.direction,
        onThreshold: thresholds.onThreshold,
        offThreshold: thresholds.offThreshold
      },
      vpdAssist: {
        enabled: vpdAssist,
        targetKpa: thresholds.vpdTargetKpa
      },
      staleTimeoutSec: 120,
      minChangeMs: 1000,
      maxOnMs: 60000,
      rssiMin: -100,
      consecutiveHits: 1
    }
  };
};

const createProbeConfig = (sensor: SensorUnderTest): ShellyThermostatConfig => {
  const base = createDefaultShellyThermostatConfig(sensor.profileId, 'heating');

  return {
    ...base,
    sensor: {
      ...base.sensor,
      sensorId: `${sensor.profileId}-${sensor.runtimeAddress.replace(/:/g, '')}`,
      runtimeAddress: sensor.runtimeAddress,
      displayName: sensor.displayName,
      parserValidated: true
    },
    rule: {
      ...base.rule,
      control: {
        metric: 'temperature',
        direction: 'below',
        onThreshold: -39,
        offThreshold: -38
      },
      staleTimeoutSec: 120,
      minChangeMs: 1000,
      maxOnMs: 60000,
      rssiMin: -100,
      consecutiveHits: 1
    }
  };
};

const installRuntime = async (
  client: RpcShellyClient,
  config: ShellyThermostatConfig
): Promise<{ scriptId: number; scriptBytes: number }> => {
  const code = generateShellyThermostatScript(config);
  const install = await client.installScript({
    scriptName: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
    code,
    runOnBoot: true,
    backupExisting: false,
    chunkSizeBytes: 1024
  });
  if (!install.ok) {
    throw new Error(install.error.technicalMessage ?? install.error.kind);
  }

  return {
    scriptId: install.value.scriptId,
    scriptBytes: new TextEncoder().encode(code).length
  };
};

const waitForPhase = async (options: {
  shellyUrl: URL;
  transport: ShellyRpcTransport;
  scriptId: number;
  timeoutMs: number;
  pollMs: number;
  rpcTimeoutMs: number;
  expectedReason?: string | undefined;
  expectedRelayOn?: boolean | undefined;
}): Promise<PhaseResult> => {
  const endpointUrl = new URL(`/script/${options.scriptId}/diag`, options.shellyUrl);
  const deadline = Date.now() + options.timeoutMs;
  let attempts = 0;
  let lastDiag: ParsedDiag | undefined;
  let lastRelayOn = false;

  while (Date.now() <= deadline) {
    attempts += 1;
    const diagResult = await fetchJson(endpointUrl, options.rpcTimeoutMs);
    if (diagResult.ok) {
      const diag = parseDiag(diagResult.value);
      const relayOn = await switchRelayOn(options.transport, options.rpcTimeoutMs);
      lastDiag = diag;
      lastRelayOn = relayOn;

      const reasonMatches =
        options.expectedReason === undefined ||
        diag.lastReason === options.expectedReason;
      const relayMatches =
        options.expectedRelayOn === undefined ||
        (diag.relayState === options.expectedRelayOn &&
          relayOn === options.expectedRelayOn);

      if (diag.measurement && reasonMatches && relayMatches) {
        return { diag, relayOn, attempts };
      }
    }
    await delay(options.pollMs);
  }

  throw new Error(
    `Timed out waiting for diag phase. Last diag=${JSON.stringify(
      lastDiag?.raw ?? null
    )}, lastRelayOn=${String(lastRelayOn)}`
  );
};

const evalRuntime = async (
  transport: ShellyRpcTransport,
  scriptId: number,
  code: string,
  timeoutMs: number
): Promise<unknown> =>
  rpcValueOrThrow(
    transport.call<unknown>(
      {
        method: RPC_METHODS.ScriptEval,
        params: { id: scriptId, code }
      },
      { timeoutMs }
    ),
    'Script.Eval'
  );

const readSensors = (): SensorUnderTest[] => [
  {
    profileId: 'xiaomi_lywsd03mmc_bthome_v2',
    runtimeAddress: normalizeMacAddress(readRequiredEnv('XIAOMI_MAC')),
    displayName: 'Xiaomi/PVVX hardware matrix'
  },
  {
    profileId: 'tp357_custom_v1',
    runtimeAddress: normalizeMacAddress(readRequiredEnv('TP357_MAC')),
    displayName: 'TP357 hardware matrix'
  }
];

const run = async (): Promise<void> => {
  const shellyUrl = new URL(readRequiredEnv('SHELLY_URL'));
  const timeoutMs = readIntegerEnv('PHASE_TIMEOUT_MS', 90000, 10000, 300000);
  const pollMs = readIntegerEnv('POLL_MS', 2000, 500, 30000);
  const rpcTimeoutMs = readIntegerEnv('RPC_TIMEOUT_MS', 8000, 1000, 60000);
  const transport = new FetchShellyRpcTransport({
    baseUrl: shellyUrl.toString(),
    defaultTimeoutMs: rpcTimeoutMs
  });
  const client = new RpcShellyClient(transport);
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    shellyUrl: shellyUrl.toString(),
    cases: []
  };
  const cases = report.cases as MatrixResult[];
  let finalScriptId: number | undefined;

  try {
    report.deviceInfo = rpcResultToJson(
      await transport.call({ method: RPC_METHODS.ShellyGetDeviceInfo })
    );
    report.statusBefore = rpcResultToJson(
      await transport.call({ method: RPC_METHODS.ShellyGetStatus })
    );

    for (const sensor of readSensors()) {
      console.log(`[probe] ${sensor.displayName} ${sensor.runtimeAddress}`);
      const probe = await installRuntime(client, createProbeConfig(sensor));
      finalScriptId = probe.scriptId;
      const probePhase = await waitForPhase({
        shellyUrl,
        transport,
        scriptId: probe.scriptId,
        timeoutMs,
        pollMs,
        rpcTimeoutMs,
        expectedRelayOn: false
      });
      let latestMeasurement = probePhase.diag.measurement;
      if (!latestMeasurement) {
        throw new Error(`No BLE measurement for ${sensor.displayName}.`);
      }

      for (const spec of modes) {
        for (const vpdAssist of vpdOptions) {
          const result: MatrixResult = {
            sensor: sensor.profileId,
            mode: spec.mode,
            vpdAssist,
            ok: false
          };
          cases.push(result);
          console.log(`[case] ${sensor.profileId} ${spec.mode} VPD=${String(vpdAssist)}`);

          try {
            const onThresholds = createThresholds(
              spec,
              latestMeasurement,
              'on',
              vpdAssist
            );
            const onConfig = createConfig(sensor, spec, onThresholds, vpdAssist);
            const install = await installRuntime(client, onConfig);
            finalScriptId = install.scriptId;
            result.scriptId = install.scriptId;
            result.scriptBytes = install.scriptBytes;
            result.on = await waitForPhase({
              shellyUrl,
              transport,
              scriptId: install.scriptId,
              timeoutMs,
              pollMs,
              rpcTimeoutMs,
              expectedReason: spec.onReason,
              expectedRelayOn: true
            });
            latestMeasurement = result.on.diag.measurement ?? latestMeasurement;

            const offThresholds = createThresholds(
              spec,
              latestMeasurement,
              'off',
              vpdAssist
            );
            const evalCode = [
              `C.on=${numberLiteral(offThresholds.onThreshold)}`,
              `C.off=${numberLiteral(offThresholds.offThreshold)}`,
              `C.vp=${numberLiteral(vpdAssist ? offThresholds.vpdTargetKpa : 0)}`,
              'R.lc=0',
              'R.nh=0',
              'R.fh=0',
              '"thresholds-updated"'
            ].join(';');
            result.evalResult = await evalRuntime(
              transport,
              install.scriptId,
              evalCode,
              rpcTimeoutMs
            );
            result.off = await waitForPhase({
              shellyUrl,
              transport,
              scriptId: install.scriptId,
              timeoutMs,
              pollMs,
              rpcTimeoutMs,
              expectedReason: spec.offReason,
              expectedRelayOn: false
            });
            latestMeasurement = result.off.diag.measurement ?? latestMeasurement;
            result.ok = true;
          } catch (error) {
            result.error = errorMessage(error);
            throw error;
          } finally {
            await transport.call({
              method: RPC_METHODS.SwitchSet,
              params: { id: 0, on: false }
            });
          }
        }
      }
    }

    report.ok = cases.every((entry) => entry.ok);
  } catch (error) {
    report.ok = false;
    report.error = errorMessage(error);
    process.exitCode = 1;
  } finally {
    if (finalScriptId !== undefined) {
      report.finalStop = rpcResultToJson(await client.stopScript(finalScriptId));
    }
    report.finalOff = rpcResultToJson(await client.setRelayOff({ relayId: 0 }));
    report.relayAfter = rpcResultToJson(
      await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } })
    );
    report.finishedAt = new Date().toISOString();
    console.log(JSON.stringify(report, null, 2));
  }
};

await run();
