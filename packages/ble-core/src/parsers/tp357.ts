import type {
  BleCoreError,
  NormalizedBleAdvertisement,
  ParsedSensorAdvertisement,
  Result
} from '../model.js';

const TP357_NAME_PREFIX = 'TP357';
const AD_TYPE_SHORTENED_LOCAL_NAME = 0x08;
const AD_TYPE_COMPLETE_LOCAL_NAME = 0x09;
const AD_TYPE_MANUFACTURER_DATA = 0xff;

type Tp357DecodedPayload = {
  temperatureC: number;
  humidityPct: number;
  batteryPct: number;
};

const error = (
  kind: BleCoreError['kind'],
  message: string,
  retryable = false
): Result<ParsedSensorAdvertisement, BleCoreError> => ({
  ok: false,
  error: { kind, message, retryable }
});

const int16LittleEndian = (payload: Uint8Array, offset: number): number => {
  const value = (payload[offset] ?? 0) | ((payload[offset + 1] ?? 0) << 8);
  return value & 0x8000 ? value - 0x10000 : value;
};

const bytesMatchText = (payload: Uint8Array, offset: number, text: string): boolean => {
  if (offset + text.length > payload.length) {
    return false;
  }

  for (let index = 0; index < text.length; index += 1) {
    if (payload[offset + index] !== text.charCodeAt(index)) {
      return false;
    }
  }

  return true;
};

const rawAdvertisementHasNamePrefix = (
  payload: Uint8Array | undefined,
  prefix: string
): boolean => {
  if (!payload || payload.length === 0) {
    return false;
  }

  let offset = 0;
  while (offset < payload.length) {
    const fieldLength = payload[offset];
    if (fieldLength === undefined || fieldLength === 0) {
      break;
    }

    const fieldStart = offset + 1;
    const fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > payload.length) {
      break;
    }

    const adType = payload[fieldStart];
    const dataOffset = fieldStart + 1;
    const dataLength = fieldLength - 1;

    if (
      (adType === AD_TYPE_SHORTENED_LOCAL_NAME ||
        adType === AD_TYPE_COMPLETE_LOCAL_NAME) &&
      dataLength >= prefix.length &&
      bytesMatchText(payload, dataOffset, prefix)
    ) {
      return true;
    }

    offset = fieldEnd;
  }

  return false;
};

const extractManufacturerDataFromRawAdvertisement = (
  payload: Uint8Array | undefined
): Uint8Array[] => {
  if (!payload || payload.length === 0) {
    return [];
  }

  const values: Uint8Array[] = [];
  let offset = 0;
  while (offset < payload.length) {
    const fieldLength = payload[offset];
    if (fieldLength === undefined || fieldLength === 0) {
      break;
    }

    const fieldStart = offset + 1;
    const fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > payload.length) {
      break;
    }

    const adType = payload[fieldStart];
    if (adType === AD_TYPE_MANUFACTURER_DATA && fieldLength >= 2) {
      values.push(payload.slice(fieldStart + 1, fieldEnd));
    }

    offset = fieldEnd;
  }

  return values;
};

const parseManufacturerKey = (key: string): number | null => {
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const value = trimmed.toLowerCase().startsWith('0x')
    ? Number.parseInt(trimmed.slice(2), 16)
    : /^[0-9]+$/.test(trimmed)
      ? Number.parseInt(trimmed, 10)
      : /^[0-9a-f]+$/i.test(trimmed)
        ? Number.parseInt(trimmed, 16)
        : Number.NaN;

  return Number.isInteger(value) && value >= 0 && value <= 0xffff ? value : null;
};

const prependManufacturerId = (
  manufacturerId: number,
  payload: Uint8Array
): Uint8Array => {
  const combined = new Uint8Array(payload.length + 2);
  combined[0] = manufacturerId & 0xff;
  combined[1] = (manufacturerId >> 8) & 0xff;
  combined.set(payload, 2);
  return combined;
};

export const parseTp357ManufacturerData = (
  payload: Uint8Array
): Result<Tp357DecodedPayload, BleCoreError> => {
  if (payload.length < 6) {
    return {
      ok: false,
      error: {
        kind: 'validation-failed',
        message: 'TP357 manufacturer data is too short.',
        retryable: true
      }
    };
  }

  const temperatureC = int16LittleEndian(payload, 1) / 10;
  const humidityPct = payload[3] ?? 0;
  const batteryPct = payload[4] ?? 0;

  if (humidityPct > 100 || temperatureC < -50 || temperatureC > 100) {
    return {
      ok: false,
      error: {
        kind: 'validation-failed',
        message: 'TP357 manufacturer data is outside sane ranges.',
        retryable: true
      }
    };
  }

  return {
    ok: true,
    value: {
      temperatureC,
      humidityPct,
      batteryPct
    }
  };
};

const extractManufacturerDataCandidates = (
  advertisement: NormalizedBleAdvertisement
): Uint8Array[] => {
  const candidates = extractManufacturerDataFromRawAdvertisement(
    advertisement.rawAdvertisement
  );

  Object.entries(advertisement.manufacturerData).forEach(([key, payload]) => {
    candidates.push(payload);

    const manufacturerId = parseManufacturerKey(key);
    if (manufacturerId !== null) {
      candidates.push(prependManufacturerId(manufacturerId, payload));
    }
  });

  return candidates;
};

export const parseTp357Advertisement = (
  advertisement: NormalizedBleAdvertisement
): Result<ParsedSensorAdvertisement, BleCoreError> => {
  const hasTp357Name =
    advertisement.name?.startsWith(TP357_NAME_PREFIX) === true ||
    rawAdvertisementHasNamePrefix(advertisement.rawAdvertisement, TP357_NAME_PREFIX);

  if (!hasTp357Name) {
    return error(
      'sensor-unsupported',
      'Advertisement does not identify itself as TP357.',
      true
    );
  }

  const candidates = extractManufacturerDataCandidates(advertisement);
  if (candidates.length === 0) {
    return error(
      'validation-failed',
      'TP357 advertisement has no manufacturer data.',
      true
    );
  }

  for (const candidate of candidates) {
    const parsed = parseTp357ManufacturerData(candidate);
    if (parsed.ok) {
      return {
        ok: true,
        value: {
          profileId: 'tp357_custom_v1',
          confidence: 'high',
          rawKind: 'tp357-custom',
          measurement: {
            sensorId: advertisement.id,
            source: advertisement.platform === 'demo' ? 'demo' : 'phone-scan',
            temperatureC: parsed.value.temperatureC,
            humidityPct: parsed.value.humidityPct,
            batteryPct: parsed.value.batteryPct,
            rssi: advertisement.rssi,
            seenAtMs: advertisement.seenAtMs
          }
        }
      };
    }
  }

  return error(
    'validation-failed',
    'TP357 manufacturer data could not be decoded.',
    true
  );
};
