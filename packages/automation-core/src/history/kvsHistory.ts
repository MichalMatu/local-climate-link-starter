export const LCL_HISTORY_FORMAT_VERSION = 1 as const;
export const LCL_HISTORY_KVS_PREFIX = 'lcl.tail.';
export const LCL_HISTORY_KVS_META_KEY = 'lcl.tail.m';
export const LCL_HISTORY_DEFAULT_SLOT_COUNT = 32;
export const LCL_HISTORY_MAX_SLOT_COUNT = 40;
export const LCL_HISTORY_MAX_VALUE_CHARS = 253;

export interface LclHistorySample {
  temperatureC: number | null;
  humidityPct: number | null;
  relayOn: boolean;
}

export interface LclHistorySegment {
  version: typeof LCL_HISTORY_FORMAT_VERSION;
  samples: readonly LclHistorySample[];
}

export interface LclHistoryMeta {
  version: typeof LCL_HISTORY_FORMAT_VERSION;
  slots: number;
  nextSlot: number;
  validSlots: number;
}

export type LclHistoryCodecErrorCode = 'invalid-value' | 'value-too-long';

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
  temperatureDeciC: number | null,
  humidityDeciPct: number | null,
  relayOn: 0 | 1
];

type EncodedSegment = [
  version: typeof LCL_HISTORY_FORMAT_VERSION,
  records: EncodedRecord[]
];

type EncodedMeta = [
  version: typeof LCL_HISTORY_FORMAT_VERSION,
  slots: number,
  nextSlot: number,
  validSlots: number
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
  if (sample.temperatureC !== null && !isFiniteInRange(sample.temperatureC, -100, 200)) {
    return failure('invalid-value', 'History temperature is outside the supported range.');
  }
  if (sample.humidityPct !== null && !isFiniteInRange(sample.humidityPct, 0, 100)) {
    return failure('invalid-value', 'History humidity is outside the supported range.');
  }
  return success(sample);
};

const scale = (value: number | null, multiplier: number): number | null =>
  value === null ? null : Math.round(value * multiplier);

const unscale = (value: number | null, multiplier: number): number | null =>
  value === null ? null : value / multiplier;

const encodeRecord = (sample: LclHistorySample): EncodedRecord => [
  scale(sample.temperatureC, 10),
  scale(sample.humidityPct, 10),
  sample.relayOn ? 1 : 0
];

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
    !isIntegerAtLeast(meta.validSlots, 0) ||
    meta.validSlots > meta.slots
  ) {
    return failure('invalid-value', 'History metadata is invalid.');
  }

  const encoded: EncodedMeta = [
    LCL_HISTORY_FORMAT_VERSION,
    meta.slots,
    meta.nextSlot,
    meta.validSlots
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
  if (!Array.isArray(parsed) || parsed.length !== 4) {
    return failure('invalid-value', 'History metadata shape is invalid.');
  }
  const [version, slots, nextSlot, validSlots] = parsed;
  const meta: LclHistoryMeta = {
    version: version as typeof LCL_HISTORY_FORMAT_VERSION,
    slots: slots as number,
    nextSlot: nextSlot as number,
    validSlots: validSlots as number
  };
  const encoded = encodeLclHistoryMeta(meta);
  return encoded.ok ? success(meta) : encoded;
};

export const encodeLclHistorySegment = (
  segment: LclHistorySegment
): LclHistoryCodecResult<string> => {
  if (segment.version !== LCL_HISTORY_FORMAT_VERSION || segment.samples.length === 0) {
    return failure('invalid-value', 'History segment is invalid.');
  }

  const records: EncodedRecord[] = [];
  for (const sample of segment.samples) {
    const validated = validateSample(sample);
    if (!validated.ok) return validated;
    records.push(encodeRecord(sample));
  }

  const text = JSON.stringify([LCL_HISTORY_FORMAT_VERSION, records] satisfies EncodedSegment);
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
  if (!Array.isArray(parsed) || parsed.length !== 2) {
    return failure('invalid-value', 'History segment shape is invalid.');
  }
  const [version, rawRecords] = parsed;
  if (version !== LCL_HISTORY_FORMAT_VERSION || !Array.isArray(rawRecords) || rawRecords.length === 0) {
    return failure('invalid-value', 'History segment header is invalid.');
  }

  const samples: LclHistorySample[] = [];
  for (const rawRecord of rawRecords) {
    if (!Array.isArray(rawRecord) || rawRecord.length !== 3) {
      return failure('invalid-value', 'History record shape is invalid.');
    }
    const [temperatureDeciC, humidityDeciPct, relayOn] = rawRecord;
    const scaledValues = [temperatureDeciC, humidityDeciPct];
    if (
      scaledValues.some(
        (entry) => entry !== null && (typeof entry !== 'number' || !Number.isInteger(entry))
      ) ||
      (relayOn !== 0 && relayOn !== 1)
    ) {
      return failure('invalid-value', 'History record value is invalid.');
    }
    const sample: LclHistorySample = {
      temperatureC: unscale(temperatureDeciC as number | null, 10),
      humidityPct: unscale(humidityDeciPct as number | null, 10),
      relayOn: relayOn === 1
    };
    const validated = validateSample(sample);
    if (!validated.ok) return validated;
    samples.push(sample);
  }

  return success({ version: LCL_HISTORY_FORMAT_VERSION, samples });
};

export const createLclHistorySegment = (
  sample: LclHistorySample
): LclHistoryCodecResult<LclHistorySegment> => {
  const segment: LclHistorySegment = {
    version: LCL_HISTORY_FORMAT_VERSION,
    samples: [sample]
  };
  const encoded = encodeLclHistorySegment(segment);
  return encoded.ok ? success(segment) : encoded;
};

export const appendLclHistorySample = (
  segment: LclHistorySegment,
  sample: LclHistorySample
): LclHistoryCodecResult<LclHistorySegment> => {
  const candidate: LclHistorySegment = {
    ...segment,
    samples: [...segment.samples, sample]
  };
  const encoded = encodeLclHistorySegment(candidate);
  return encoded.ok ? success(candidate) : encoded;
};

export interface LclHistoryChangeThresholds {
  temperatureDeltaC: number;
  humidityDeltaPct: number;
}

export const lclHistorySampleChangedEnough = (
  previous: LclHistorySample | null,
  next: LclHistorySample,
  thresholds: LclHistoryChangeThresholds = {
    temperatureDeltaC: 0.3,
    humidityDeltaPct: 1
  }
): boolean => {
  if (previous === null || previous.relayOn !== next.relayOn) return true;
  if (
    previous.temperatureC === null ||
    next.temperatureC === null ||
    previous.humidityPct === null ||
    next.humidityPct === null
  ) {
    return previous.temperatureC !== next.temperatureC || previous.humidityPct !== next.humidityPct;
  }
  return (
    Math.abs(previous.temperatureC - next.temperatureC) >= thresholds.temperatureDeltaC ||
    Math.abs(previous.humidityPct - next.humidityPct) >= thresholds.humidityDeltaPct
  );
};

export const decodeLclHistoryKvsItems = (
  items: readonly LclHistoryKvsItem[]
): LclHistoryDecodedStore => {
  let meta: LclHistoryMeta | null = null;
  const bySlot = new Map<number, LclHistorySegment>();
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
    if (decoded.ok) bySlot.set(slot, decoded.value);
    else invalidKeys.push(item.key);
  }

  const segments: Array<{ slot: number; segment: LclHistorySegment }> = [];
  if (meta) {
    const count = Math.min(meta.validSlots, meta.slots);
    const first = (meta.nextSlot - count + meta.slots) % meta.slots;
    for (let index = 0; index < count; index += 1) {
      const slot = (first + index) % meta.slots;
      const segment = bySlot.get(slot);
      if (segment) segments.push({ slot, segment });
    }
  } else {
    for (const [slot, segment] of [...bySlot.entries()].sort((a, b) => a[0] - b[0])) {
      segments.push({ slot, segment });
    }
  }

  return {
    meta,
    segments,
    samples: segments.flatMap(({ segment }) => segment.samples),
    invalidKeys
  };
};
