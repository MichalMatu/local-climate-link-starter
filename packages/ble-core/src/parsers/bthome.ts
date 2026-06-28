import type {
  BthomeParseContext,
  BleCoreError,
  NormalizedBleAdvertisement,
  ParsedSensorAdvertisement,
  Result
} from '../model.js';

const BTHOME_SERVICE_UUID = 'fcd2';
const BTHOME_SERVICE_UUID_VALUE = 0xfcd2;
const BTHOME_VERSION = 2;
const AD_TYPE_SERVICE_DATA_16_BIT_UUID = 0x16;

const normalizeUuid = (uuid: string): string =>
  uuid.toLowerCase().replace(/^0x/, '').replace(/-/g, '');

const int16LittleEndian = (payload: Uint8Array, offset: number): number => {
  const value = (payload[offset] ?? 0) | ((payload[offset + 1] ?? 0) << 8);
  return value & 0x8000 ? value - 0x10000 : value;
};

const uint16LittleEndian = (payload: Uint8Array, offset: number): number =>
  (payload[offset] ?? 0) | ((payload[offset + 1] ?? 0) << 8);

const error = (
  kind: BleCoreError['kind'],
  message: string,
  retryable = false
): Result<ParsedSensorAdvertisement, BleCoreError> => ({
  ok: false,
  error: { kind, message, retryable }
});

const ensureBytes = (payload: Uint8Array, offset: number, length: number): boolean =>
  offset + length <= payload.length;

const extractBthomeV2PayloadFromRawAdvertisement = (
  payload: Uint8Array | undefined
): Uint8Array | null => {
  if (!payload || payload.length === 0) {
    return null;
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
    if (adType === AD_TYPE_SERVICE_DATA_16_BIT_UUID && fieldLength >= 3) {
      const serviceUuid =
        (payload[fieldStart + 1] ?? 0) | ((payload[fieldStart + 2] ?? 0) << 8);
      if (serviceUuid === BTHOME_SERVICE_UUID_VALUE) {
        return payload.slice(fieldStart + 3, fieldEnd);
      }
    }

    offset = fieldEnd;
  }

  return null;
};

export const parseBthomeV2Payload = (
  payload: Uint8Array,
  context: BthomeParseContext
): Result<ParsedSensorAdvertisement, BleCoreError> => {
  if (payload.length < 2) {
    return error('validation-failed', 'BTHome payload is too short.');
  }

  const deviceInfo = payload[0] ?? 0;
  const encrypted = (deviceInfo & 0x01) === 0x01;
  const version = deviceInfo >> 5;

  if (encrypted) {
    return error('sensor-unsupported', 'Encrypted BTHome v2 is not part of the MVP.');
  }

  if (version !== BTHOME_VERSION) {
    return error('sensor-unsupported', `Unsupported BTHome version ${version}.`);
  }

  let temperatureC: number | undefined;
  let humidityPct: number | undefined;
  let batteryPct: number | undefined;
  let voltageV: number | undefined;
  let stoppedByUnknownObject = false;
  let offset = 1;

  while (offset < payload.length) {
    const objectId = payload[offset];
    if (objectId === undefined) {
      return error('validation-failed', 'BTHome object id is missing.');
    }
    offset += 1;

    switch (objectId) {
      case 0x00:
        if (!ensureBytes(payload, offset, 1)) {
          return error('validation-failed', 'Packet id object is truncated.');
        }
        offset += 1;
        break;
      case 0x01:
        if (!ensureBytes(payload, offset, 1)) {
          return error('validation-failed', 'Battery object is truncated.');
        }
        batteryPct = payload[offset] ?? 0;
        offset += 1;
        break;
      case 0x0c:
        if (!ensureBytes(payload, offset, 2)) {
          return error('validation-failed', 'Voltage object is truncated.');
        }
        voltageV = uint16LittleEndian(payload, offset) / 1000;
        offset += 2;
        break;
      case 0x02:
        if (!ensureBytes(payload, offset, 2)) {
          return error('validation-failed', 'Temperature object is truncated.');
        }
        temperatureC = int16LittleEndian(payload, offset) / 100;
        offset += 2;
        break;
      case 0x03:
        if (!ensureBytes(payload, offset, 2)) {
          return error('validation-failed', 'Humidity object is truncated.');
        }
        humidityPct = uint16LittleEndian(payload, offset) / 100;
        offset += 2;
        break;
      case 0x2e:
        if (!ensureBytes(payload, offset, 1)) {
          return error('validation-failed', 'Short humidity object is truncated.');
        }
        humidityPct = payload[offset];
        offset += 1;
        break;
      case 0x45:
        if (!ensureBytes(payload, offset, 2)) {
          return error('validation-failed', 'Short temperature object is truncated.');
        }
        temperatureC = int16LittleEndian(payload, offset) / 10;
        offset += 2;
        break;
      default:
        stoppedByUnknownObject = true;
        offset = payload.length;
        break;
    }
  }

  if (
    temperatureC === undefined &&
    humidityPct === undefined &&
    batteryPct === undefined &&
    voltageV === undefined
  ) {
    return stoppedByUnknownObject
      ? error(
          'sensor-unsupported',
          'BTHome payload only contained unsupported object ids.'
        )
      : error('validation-failed', 'BTHome payload did not contain supported fields.');
  }

  return {
    ok: true,
    value: {
      profileId: 'xiaomi_lywsd03mmc_bthome_v2',
      confidence: stoppedByUnknownObject ? 'medium' : 'high',
      rawKind: 'bthome-v2',
      measurement: {
        sensorId: context.sensorId,
        source: context.source,
        temperatureC,
        humidityPct,
        batteryPct,
        voltageV,
        rssi: context.rssi,
        seenAtMs: context.seenAtMs
      }
    }
  };
};

export const extractBthomeV2Payload = (
  advertisement: NormalizedBleAdvertisement
): Result<Uint8Array, BleCoreError> => {
  const serviceDataEntry = Object.entries(advertisement.serviceData).find(([uuid]) =>
    normalizeUuid(uuid).endsWith(BTHOME_SERVICE_UUID)
  );

  if (!serviceDataEntry) {
    const payload = extractBthomeV2PayloadFromRawAdvertisement(
      advertisement.rawAdvertisement
    );
    if (payload) {
      return { ok: true, value: payload };
    }

    return {
      ok: false,
      error: {
        kind: 'validation-failed',
        message: 'Advertisement has no BTHome service data.',
        retryable: true
      }
    };
  }

  const payload = serviceDataEntry[1];
  if ((payload[0] ?? 0) === 0xd2 && (payload[1] ?? 0) === 0xfc) {
    return { ok: true, value: payload.slice(2) };
  }

  return { ok: true, value: payload };
};

export const parseBthomeV2Advertisement = (
  advertisement: NormalizedBleAdvertisement
): Result<ParsedSensorAdvertisement, BleCoreError> => {
  const extracted = extractBthomeV2Payload(advertisement);
  if (!extracted.ok) {
    return extracted;
  }

  return parseBthomeV2Payload(extracted.value, {
    sensorId: advertisement.id,
    rssi: advertisement.rssi,
    seenAtMs: advertisement.seenAtMs,
    source: advertisement.platform === 'demo' ? 'demo' : 'phone-scan'
  });
};

export const BTHOME_V2_SERVICE_UUID = BTHOME_SERVICE_UUID;
