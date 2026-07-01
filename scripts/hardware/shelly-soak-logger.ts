import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const USAGE =
  'Usage: SHELLY_URL=http://<shelly-ip> [SCRIPT_ID=1] [SOAK_INTERVAL_MS=5000] pnpm hardware:shelly:soak';

type JsonRecord = Record<string, unknown>;

type EndpointResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string; status?: number | undefined };

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
    lastSeenMs?: number | undefined;
    lastPacketSeenMs?: number | undefined;
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
    lastChangeMs?: number | undefined;
    onStartedMs?: number | undefined;
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
  lastMeasurementSeenMs?: number | undefined;
  lastPacketSeenMs?: number | undefined;
  lastMeasurementWallMs?: number | undefined;
  lastPacketWallMs?: number | undefined;
  reasonCounts: Record<string, number>;
  errorCounts: Record<string, number>;
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

const parseDiag = (diag: unknown): Partial<ParsedSample> => {
  if (!isRecord(diag)) {
    return {};
  }

  const sensorMeta = arrayField(diag, 's');
  const ruleMeta = arrayField(diag, 'q');
  const timeMeta = arrayField(diag, 'y');
  const plugMeta = arrayField(diag, 'p');
  const runtime = arrayField(diag, 'g');

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
      lastSeenMs: numberField(runtime?.[0]),
      lastPacketSeenMs: numberField(runtime?.[15]),
      temperatureC: numberField(runtime?.[1]),
      humidityPct: numberField(runtime?.[2]),
      batteryPct: numberField(runtime?.[3]),
      rssiDbm: numberField(runtime?.[4])
    },
    rule: {
      metric: ruleMeta?.[0] === 1 ? 'humidity' : 'temperature',
      direction: ruleMeta?.[1] === 1 ? 'above' : 'below',
      onThreshold: numberField(ruleMeta?.[2]),
      offThreshold: numberField(ruleMeta?.[3]),
      staleTimeoutSec: numberField(ruleMeta?.[4]),
      rssiMin: numberField(ruleMeta?.[5]),
      scriptHash: stringField(diag.z)
    },
    decision: {
      reason: stringField(runtime?.[6]),
      lastChangeMs: numberField(runtime?.[7]),
      onStartedMs: numberField(runtime?.[8]),
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
  if (uptimeMs !== undefined && parsed.sensor.lastSeenMs !== undefined) {
    parsed.sensor.ageSinceMeasurementMs = Math.max(
      0,
      uptimeMs - parsed.sensor.lastSeenMs
    );
  }
  if (uptimeMs !== undefined && parsed.sensor.lastPacketSeenMs !== undefined) {
    parsed.sensor.ageSincePacketMs = Math.max(
      0,
      uptimeMs - parsed.sensor.lastPacketSeenMs
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

  if (parsed.sensor.lastSeenMs !== undefined) {
    summary.samplesWithMeasurement += 1;
    if (parsed.sensor.lastSeenMs !== summary.lastMeasurementSeenMs) {
      if (summary.lastMeasurementWallMs !== undefined) {
        summary.maxNoMeasurementUpdateMs = Math.max(
          summary.maxNoMeasurementUpdateMs,
          sampledAtMs - summary.lastMeasurementWallMs
        );
      }
      summary.lastMeasurementSeenMs = parsed.sensor.lastSeenMs;
      summary.lastMeasurementWallMs = sampledAtMs;
    } else if (summary.lastMeasurementWallMs !== undefined) {
      summary.maxNoMeasurementUpdateMs = Math.max(
        summary.maxNoMeasurementUpdateMs,
        sampledAtMs - summary.lastMeasurementWallMs
      );
    }
  }

  if (parsed.sensor.lastPacketSeenMs !== undefined) {
    summary.samplesWithPacket += 1;
    if (parsed.sensor.lastPacketSeenMs !== summary.lastPacketSeenMs) {
      if (summary.lastPacketWallMs !== undefined) {
        summary.maxNoPacketUpdateMs = Math.max(
          summary.maxNoPacketUpdateMs,
          sampledAtMs - summary.lastPacketWallMs
        );
      }
      summary.lastPacketSeenMs = parsed.sensor.lastPacketSeenMs;
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
    errorCounts: {}
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
    durationMs: durationMs || null
  });

  console.log(`Shelly soak logger started`);
  console.log(`JSONL: ${outFile}`);
  console.log(`Summary: ${summaryFile}`);

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

      const reason = parsed.decision.reason ?? 'brak';
      const relay = parsed.relay.rpcOn ?? parsed.relay.diagOn;
      const age = parsed.sensor.ageSinceMeasurementMs;
      console.log(
        [
          `#${sequence}`,
          `reason=${reason}`,
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
    const summaryMarkdown = createSummaryMarkdown({
      summary,
      shellyUrl: shellyUrl.toString(),
      scriptId,
      outFile,
      summaryFile,
      intervalMs
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
