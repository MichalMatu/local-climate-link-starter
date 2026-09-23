export const LCL_HISTORY_FORMAT_VERSION = 1 as const;
export const LCL_HISTORY_KVS_PREFIX = 'lcl.dl1.';
export const LCL_HISTORY_KVS_META_KEY = 'lcl.dl1.m';
export const LCL_HISTORY_DEFAULT_SLOT_COUNT = 32;
export const LCL_HISTORY_MAX_SLOT_COUNT = 40;
export const LCL_HISTORY_MAX_VALUE_CHARS = 253;
export const LCL_HISTORY_DEFAULT_SAMPLE_INTERVAL_SEC = 15 * 60;
export const LCL_HISTORY_DEFAULT_FLUSH_INTERVAL_SEC = 2 * 60 * 60;
export const LCL_HISTORY_MIN_FLUSH_INTERVAL_SEC = 60 * 60;

export type LclHistoryClock = 'unix' | 'uptime';

export interface LclHistorySample {
  clock: LclHistoryClock;
  timeSec: number;
  temperatureC: number | null;
  humidityPct: number | null;
  vpdKpa: number | null;
  relayOn: boolean;
  reason: string | null;
}

export interface LclHistorySegment {
  version: typeof LCL_HISTORY_FORMAT_VERSION;
  sequence: number;
  clock: LclHistoryClock;
  baseTimeSec: number;
  samples: readonly LclHistorySample[];
}

export interface LclHistoryMeta {
  version: typeof LCL_HISTORY_FORMAT_VERSION;
  slots: number;
  nextSlot: number;
  nextSequence: number;
  sampleIntervalSec: number;
  flushIntervalSec: number;
}

export type LclHistoryCodecErrorCode =
  | 'invalid-value'
  | 'clock-mismatch'
  | 'time-regression'
  | 'value-too-long';

export interface LclHistoryCodecError {
  code: LclHistoryCodecErrorCode;
  message: string;
}

export type LclHistoryCodecResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: LclHistoryCodecError };

export interface LclHistoryKvsItem {
  key: string;
  value: unknown;
}

export interface LclHistoryDecodedStore {
  meta: LclHistoryMeta | null;
  segments: ReadonlyArray<{ slot: number; segment: LclHistorySegment }>;
  samples: readonly LclHistorySample[];
  invalidKeys: readonly string[];
}

type EncodedRecord = [
  deltaSec: number,
  temperatureDeciC: number | null,
  humidityDeciPct: number | null,
  vpdCentiKpa: number | null,
  relayOn: 0 | 1,
  reason: string | null
];

type EncodedSegment = [
  version: typeof LCL_HISTORY_FORMAT_VERSION,
  sequence: number,
  clock: 0 | 1,
  baseTimeSec: number,
  records: EncodedRecord[]
];

type EncodedMeta = [
  version: typeof LCL_HISTORY_FORMAT_VERSION,
  slots: number,
  nextSlot: number,
  nextSequence: number,
  sampleIntervalSec: number,
  flushIntervalSec: number
];

const success = <T>(value: T): LclHistoryCodecResult<T> => ({ ok: true, value });
const failure = (
  code: LclHistoryCodecErrorCode,
  message: string
): LclHistoryCodecResult<never> => ({ ok: false, error: { code, message } });

const isIntegerAtLeast = (value: unknown, minimum: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minimum;

const isFiniteInRange = (value: number, minimum: number, maximum: number): boolean =>
  Number.isFinite(value) && value >= minimum && value <= maximum;

const validateSample = (sample: LclHistorySample): LclHistoryCodecResult<LclHistorySample> => {
  if (!isIntegerAtLeast(sample.timeSec, 0)) {
    return failure('invalid-value', 'History sample time must be a non-negative integer.');
  }
  if (sample.clock !== 'unix' && sample.clock !== 'uptime') {
    return failure('invalid-value', 'History sample clock is invalid.');
  }
  if (sample.temperatureC !== null && !isFiniteInRange(sample.temperatureC, -100, 200)) {
    return failure('invalid-value', 'History temperature is outside the supported range.');
  }
  if (sample.humidityPct !== null && !isFiniteInRange(sample.humidityPct, 0, 100)) {
    return failure('invalid-value', 'History humidity is outside the supported range.');
  }
  if (sample.vpdKpa !== null && !isFiniteInRange(sample.vpdKpa, 0, 100)) {
    return failure('invalid-value', 'History VPD is outside the supported range.');
  }
  if (sample.reason !== null && (sample.reason.length === 0 || sample.reason.length > 16)) {
    return failure('invalid-value', 'History reason must contain 1 to 16 characters.');
  }
  return success(sample);
};

const scale = (value: number | null, multiplier: number): number | null =>
  value === null ? null : Math.round(value * multiplier);

const unscale = (value: number | null, multiplier: number): number | null =>
  value === null ? null : value / multiplier;

const encodeRecord = (sample: LclHistorySample, baseTimeSec: number): EncodedRecord => [
  sample.timeSec - baseTimeSec,
  scale(sample.temperatureC, 10),
  scale(sample.humidityPct, 10),
  scale(sample.vpdKpa, 100),
  sample.relayOn ? 1 : 0,
  sample.reason
];

const clockToFlag = (clock: LclHistoryClock): 0 | 1 => (clock === 'unix' ? 0 : 1);
const flagToClock = (flag: 0 | 1): LclHistoryClock => (flag === 0 ? 'unix' : 'uptime');

export const lclHistorySegmentKey = (slot: number): string => {
  if (!Number.isInteger(slot) || slot < 0 || slot >= LCL_HISTORY_MAX_SLOT_COUNT) {
    throw new RangeError(`Invalid history slot: ${slot}.`);
  }
  return `${LCL_HISTORY_KVS_PREFIX}${slot.toString().padStart(2, '0')}`;
};

export const parseLclHistorySegmentSlot = (key: string): number | null => {
  if (!key.startsWith(LCL_HISTORY_KVS_PREFIX)) return null;
  const suffix = key.slice(LCL_HISTORY_KVS_PREFIX.length);
  if (!/^\d{2}$/.test(suffix)) return null;
  const slot = Number(suffix);
  return slot < LCL_HISTORY_MAX_SLOT_COUNT ? slot : null;
};

export const encodeLclHistoryMeta = (meta: LclHistoryMeta): LclHistoryCodecResult<string> => {
  if (
    meta.version !== LCL_HISTORY_FORMAT_VERSION ||
    !isIntegerAtLeast(meta.slots, 1) ||
    meta.slots > LCL_HISTORY_MAX_SLOT_COUNT ||
    !isIntegerAtLeast(meta.nextSlot, 0) ||
    meta.nextSlot >= meta.slots ||
    !isIntegerAtLeast(meta.nextSequence, 0) ||
    !isIntegerAtLeast(meta.sampleIntervalSec, 1) ||
    !isIntegerAtLeast(meta.flushIntervalSec, LCL_HISTORY_MIN_FLUSH_INTERVAL_SEC)
  ) {
    return failure('invalid-value', 'History metadata is invalid.');
  }

  const encoded: EncodedMeta = [
    LCL_HISTORY_FORMAT_VERSION,
    meta.slots,
    meta.nextSlot,
    meta.nextSequence,
    meta.sampleIntervalSec,
    meta.flushIntervalSec
  ];
  const text = JSON.stringify(encoded);
  return text.length <= LCL_HISTORY_MAX_VALUE_CHARS
    ? success(text)
    : failure('value-too-long', 'History metadata exceeds the Shelly KVS value limit.');
};

export const decodeLclHistoryMeta = (value: unknown): LclHistoryCodecResult<LclHistoryMeta> => {
  if (typeof value !== 'string') {
    return failure('invalid-value', 'History metadata must be a JSON string.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return failure('invalid-value', 'History metadata is not valid JSON.');
  }
  if (!Array.isArray(parsed) || parsed.length !== 6) {
    return failure('invalid-value', 'History metadata shape is invalid.');
  }
  const [version, slots, nextSlot, nextSequence, sampleIntervalSec, flushIntervalSec] = parsed;
  const meta: LclHistoryMeta = {
    version: version as typeof LCL_HISTORY_FORMAT_VERSION,
    slots: slots as number,
    nextSlot: nextSlot as number,
    nextSequence: nextSequence as number,
    sampleIntervalSec: sampleIntervalSec as number,
    flushIntervalSec: flushIntervalSec as number
  };
  const encoded = encodeLclHistoryMeta(meta);
  return encoded.ok ? success(meta) : encoded;
};

export const encodeLclHistorySegment = (
  segment: LclHistorySegment
): LclHistoryCodecResult<string> => {
  if (
    segment.version !== LCL_HISTORY_FORMAT_VERSION ||
    !isIntegerAtLeast(segment.sequence, 0) ||
    !isIntegerAtLeast(segment.baseTimeSec, 0) ||
    segment.samples.length === 0
  ) {
    return failure('invalid-value', 'History segment header is invalid.');
  }

  const records: EncodedRecord[] = [];
  let previousTimeSec = segment.baseTimeSec;
  for (const sample of segment.samples) {
    const validated = validateSample(sample);
    if (!validated.ok) return validated;
    if (sample.clock !== segment.clock) {
      return failure('clock-mismatch', 'History segment cannot mix clock sources.');
    }
    if (sample.timeSec < segment.baseTimeSec || sample.timeSec < previousTimeSec) {
      return failure('time-regression', 'History samples must be ordered by time.');
    }
    records.push(encodeRecord(sample, segment.baseTimeSec));
    previousTimeSec = sample.timeSec;
  }

  const encoded: EncodedSegment = [
    LCL_HISTORY_FORMAT_VERSION,
    segment.sequence,
    clockToFlag(segment.clock),
    segment.baseTimeSec,
    records
  ];
  const text = JSON.stringify(encoded);
  return text.length <= LCL_HISTORY_MAX_VALUE_CHARS
    ? success(text)
    : failure('value-too-long', 'History segment exceeds the Shelly KVS value limit.');
};

export const decodeLclHistorySegment = (
  value: unknown
): LclHistoryCodecResult<LclHistorySegment> => {
  if (typeof value !== 'string') {
    return failure('invalid-value', 'History segment must be a JSON string.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return failure('invalid-value', 'History segment is not valid JSON.');
  }
  if (!Array.isArray(parsed) || parsed.length !== 5) {
    return failure('invalid-value', 'History segment shape is invalid.');
  }
  const [version, sequence, clockFlag, baseTimeSec, rawRecords] = parsed;
  if (
    version !== LCL_HISTORY_FORMAT_VERSION ||
    !isIntegerAtLeast(sequence, 0) ||
    (clockFlag !== 0 && clockFlag !== 1) ||
    !isIntegerAtLeast(baseTimeSec, 0) ||
    !Array.isArray(rawRecords) ||
    rawRecords.length === 0
  ) {
    return failure('invalid-value', 'History segment header is invalid.');
  }

  const clock = flagToClock(clockFlag);
  const samples: LclHistorySample[] = [];
  let previousTimeSec = baseTimeSec;
  for (const rawRecord of rawRecords) {
    if (!Array.isArray(rawRecord) || rawRecord.length !== 6) {
      return failure('invalid-value', 'History record shape is invalid.');
    }
    const [deltaSec, temperatureDeciC, humidityDeciPct, vpdCentiKpa, relayOn, reason] =
      rawRecord;
    const scaledValues = [temperatureDeciC, humidityDeciPct, vpdCentiKpa];
    if (
      !isIntegerAtLeast(deltaSec, 0) ||
      scaledValues.some(
        (entry) => entry !== null && (typeof entry !== 'number' || !Number.isInteger(entry))
      ) ||
      (relayOn !== 0 && relayOn !== 1) ||
      (reason !== null && typeof reason !== 'string')
    ) {
      return failure('invalid-value', 'History record value is invalid.');
    }
    const timeSec = baseTimeSec + deltaSec;
    if (timeSec < previousTimeSec) {
      return failure('time-regression', 'History records are not ordered by time.');
    }
    const sample: LclHistorySample = {
      clock,
      timeSec,
      temperatureC: unscale(temperatureDeciC as number | null, 10),
      humidityPct: unscale(humidityDeciPct as number | null, 10),
      vpdKpa: unscale(vpdCentiKpa as number | null, 100),
      relayOn: relayOn === 1,
      reason: reason as string | null
    };
    const validated = validateSample(sample);
    if (!validated.ok) return validated;
    samples.push(sample);
    previousTimeSec = timeSec;
  }

  return success({
    version: LCL_HISTORY_FORMAT_VERSION,
    sequence,
    clock,
    baseTimeSec,
    samples
  });
};

export const createLclHistorySegment = (
  sequence: number,
  sample: LclHistorySample
): LclHistoryCodecResult<LclHistorySegment> => {
  const segment: LclHistorySegment = {
    version: LCL_HISTORY_FORMAT_VERSION,
    sequence,
    clock: sample.clock,
    baseTimeSec: sample.timeSec,
    samples: [sample]
  };
  const encoded = encodeLclHistorySegment(segment);
  return encoded.ok ? success(segment) : encoded;
};

export const appendLclHistorySample = (
  segment: LclHistorySegment,
  sample: LclHistorySample
): LclHistoryCodecResult<LclHistorySegment> => {
  if (sample.clock !== segment.clock) {
    return failure('clock-mismatch', 'History segment cannot mix clock sources.');
  }
  const candidate: LclHistorySegment = {
    ...segment,
    samples: [...segment.samples, sample]
  };
  const encoded = encodeLclHistorySegment(candidate);
  return encoded.ok ? success(candidate) : encoded;
};

export const decodeLclHistoryKvsItems = (
  items: readonly LclHistoryKvsItem[]
): LclHistoryDecodedStore => {
  let meta: LclHistoryMeta | null = null;
  const segments: Array<{ slot: number; segment: LclHistorySegment }> = [];
  const invalidKeys: string[] = [];

  for (const item of items) {
    if (item.key === LCL_HISTORY_KVS_META_KEY) {
      const decoded = decodeLclHistoryMeta(item.value);
      if (decoded.ok) meta = decoded.value;
      else invalidKeys.push(item.key);
      continue;
    }
    const slot = parseLclHistorySegmentSlot(item.key);
    if (slot === null) continue;
    const decoded = decodeLclHistorySegment(item.value);
    if (decoded.ok) segments.push({ slot, segment: decoded.value });
    else invalidKeys.push(item.key);
  }

  segments.sort((left, right) => left.segment.sequence - right.segment.sequence);
  return {
    meta,
    segments,
    samples: segments.flatMap(({ segment }) => segment.samples),
    invalidKeys
  };
};
