import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import {
  createInstallPlan,
  FetchShellyRpcTransport,
  RPC_METHODS,
  RpcShellyClient
} from '@lcl/shelly-client';

type SensorProfileId = ShellyThermostatConfig['sensor']['profileId'];

const SENSOR_PROFILES = new Set<SensorProfileId>([
  'xiaomi_lywsd03mmc_bthome_v2',
  'tp357_custom_v1'
]);

const USAGE =
  'Usage: SHELLY_URL=http://<shelly-ip> SENSOR_MAC=<aa:bb:cc:dd:ee:ff> pnpm hardware:shelly:install';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. ${USAGE}`);
  }
  return value;
};

const readOptionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
};

const readNumberEnv = (
  name: string,
  fallback: number,
  min: number,
  max: number
): number => {
  const raw = readOptionalEnv(name);
  if (raw === undefined) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}.`);
  }
  return parsed;
};

const readIntegerEnv = (
  name: string,
  fallback: number,
  min: number,
  max: number
): number => {
  const parsed = readNumberEnv(name, fallback, min, max);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be a whole number.`);
  }
  return parsed;
};

const readSensorProfile = (): SensorProfileId => {
  const raw = readOptionalEnv('SENSOR_PROFILE') ?? 'xiaomi_lywsd03mmc_bthome_v2';
  if (!SENSOR_PROFILES.has(raw as SensorProfileId)) {
    throw new Error(
      `SENSOR_PROFILE must be one of ${Array.from(SENSOR_PROFILES).join(', ')}.`
    );
  }
  return raw as SensorProfileId;
};

const normalizeMacAddress = (value: string): string => {
  const compact = value.trim().replace(/[:-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) {
    throw new Error('SENSOR_MAC must be a 6-byte BLE address.');
  }

  const pairs = compact.match(/[0-9A-F]{2}/g);
  if (!pairs || pairs.length !== 6) {
    throw new Error('SENSOR_MAC must contain exactly 6 bytes.');
  }
  return pairs.join(':');
};

const createHardwareConfig = (): ShellyThermostatConfig => {
  const profileId = readSensorProfile();
  const base = createDefaultShellyThermostatConfig(profileId);
  const runtimeAddress = normalizeMacAddress(readRequiredEnv('SENSOR_MAC'));
  const compactAddress = runtimeAddress.replace(/:/g, '').toLowerCase();

  return {
    ...base,
    sensor: {
      ...base.sensor,
      sensorId: readOptionalEnv('SENSOR_ID') ?? `${profileId}-${compactAddress}`,
      runtimeAddress,
      displayName:
        readOptionalEnv('SENSOR_NAME') ??
        (profileId === 'tp357_custom_v1'
          ? `TP357 ${runtimeAddress}`
          : `Xiaomi PVVX ${runtimeAddress}`),
      parserValidated:
        readOptionalEnv('PARSER_VALIDATED') === '1' ? true : base.sensor.parserValidated
    },
    rule: {
      ...base.rule,
      control: {
        ...base.rule.control,
        onThreshold: readNumberEnv(
          'ON_THRESHOLD',
          base.rule.control.onThreshold,
          -40,
          80
        ),
        offThreshold: readNumberEnv(
          'OFF_THRESHOLD',
          base.rule.control.offThreshold,
          -40,
          80
        )
      },
      staleTimeoutSec: readIntegerEnv(
        'STALE_TIMEOUT_SEC',
        base.rule.staleTimeoutSec,
        30,
        86400
      ),
      minChangeMs: readIntegerEnv('MIN_CHANGE_MS', base.rule.minChangeMs, 1000, 86400000),
      maxOnMs: readIntegerEnv('MAX_ON_MS', base.rule.maxOnMs, 60000, 86400000),
      rssiMin: readIntegerEnv('RSSI_MIN', base.rule.rssiMin, -100, -20),
      consecutiveHits: readIntegerEnv(
        'CONSECUTIVE_HITS',
        base.rule.consecutiveHits,
        1,
        10
      )
    }
  };
};

const serializeResult = <T>(
  result: { ok: true; value: T } | { ok: false; error: unknown }
) => (result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error });

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

const hasMeasurement = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  if (Array.isArray(value.g)) {
    return value.g[0] !== null && value.g[0] !== undefined;
  }
  if (!isRecord(value.g)) {
    return false;
  }
  return value.g.ls !== null && value.g.ls !== undefined;
};

const observeDiagnostics = async (
  shellyUrl: URL,
  scriptId: number,
  observeMs: number
): Promise<Record<string, unknown>> => {
  const endpointUrl = new URL(`/script/${scriptId}/diag`, shellyUrl);
  if (observeMs <= 0) {
    return { endpointUrl: endpointUrl.toString(), skipped: true };
  }

  const deadline = Date.now() + observeMs;
  let lastSnapshot: unknown = null;
  let attempts = 0;

  while (Date.now() <= deadline) {
    attempts += 1;
    const snapshot = await fetchJson(endpointUrl, 2500);
    lastSnapshot = snapshot;
    if (snapshot.ok && hasMeasurement(snapshot.value)) {
      return {
        endpointUrl: endpointUrl.toString(),
        attempts,
        measurementSeen: true,
        snapshot: snapshot.value
      };
    }
    await delay(2000);
  }

  return {
    endpointUrl: endpointUrl.toString(),
    attempts,
    measurementSeen: false,
    snapshot: lastSnapshot
  };
};

const main = async (): Promise<void> => {
  const report: Record<string, unknown> = {};
  let transport: FetchShellyRpcTransport | null = null;

  try {
    const shellyUrl = new URL(readRequiredEnv('SHELLY_URL'));
    const config = createHardwareConfig();
    const observeMs = readIntegerEnv('OBSERVE_MS', 15000, 0, 300000);
    const code = generateShellyThermostatScript(config);

    transport = new FetchShellyRpcTransport({
      baseUrl: shellyUrl.toString(),
      defaultTimeoutMs: readIntegerEnv('RPC_TIMEOUT_MS', 8000, 1000, 60000)
    });
    const client = new RpcShellyClient(transport);

    report.config = {
      shellyUrl: shellyUrl.toString(),
      sensor: config.sensor,
      rule: config.rule,
      scriptBytes: new TextEncoder().encode(code).length
    };
    report.deviceInfo = serializeResult(
      await transport.call({ method: RPC_METHODS.ShellyGetDeviceInfo })
    );
    report.statusBefore = serializeResult(
      await transport.call({ method: RPC_METHODS.ShellyGetStatus })
    );
    report.relayBefore = serializeResult(
      await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } })
    );

    const install = await client.installScript(createInstallPlan(code));
    report.install = serializeResult(install);
    if (!install.ok) {
      process.exitCode = 1;
      return;
    }

    report.scriptList = serializeResult(
      await transport.call({ method: RPC_METHODS.ScriptList })
    );
    report.scriptStatus = serializeResult(
      await transport.call({
        method: RPC_METHODS.ScriptGetStatus,
        params: { id: install.value.scriptId }
      })
    );
    report.observation = await observeDiagnostics(
      shellyUrl,
      install.value.scriptId,
      observeMs
    );
  } catch (error) {
    process.exitCode = 1;
    report.error = errorMessage(error);
  } finally {
    if (transport) {
      report.finalOff = serializeResult(
        await transport.call({
          method: RPC_METHODS.SwitchSet,
          params: { id: 0, on: false }
        })
      );
      report.relayAfter = serializeResult(
        await transport.call({ method: RPC_METHODS.SwitchGetStatus, params: { id: 0 } })
      );
    }
    console.log(JSON.stringify(report, null, 2));
  }
};

await main();
