import {
  DEMO_BTHOME_PAYLOAD,
  DemoBleScanner,
  createDemoXiaomiAdvertisement,
  parseBthomeV2Advertisement,
  parseBthomeV2Payload,
  parseTp357Advertisement,
  parseTp357ManufacturerData
} from '../index.js';

describe('BTHome v2 parser', () => {
  it('parses a valid Xiaomi BTHome v2 fixture', () => {
    const result = parseBthomeV2Payload(DEMO_BTHOME_PAYLOAD, {
      sensorId: 'fixture-xiaomi',
      rssi: -58,
      seenAtMs: 1000,
      source: 'phone-scan'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.profileId).toBe('xiaomi_lywsd03mmc_bthome_v2');
    expect(result.value.measurement.temperatureC).toBe(21.34);
    expect(result.value.measurement.humidityPct).toBe(45.67);
    expect(result.value.measurement.batteryPct).toBe(88);
  });

  it('parses Xiaomi PVVX payloads with packet id object 0x00', () => {
    const result = parseBthomeV2Payload(
      new Uint8Array([0x40, 0x00, 0xd6, 0x01, 0x64, 0x02, 0x2e, 0x0c, 0x03, 0x40, 0x11]),
      {
        sensorId: 'xiaomi-pvvx-packet-id',
        rssi: -71,
        seenAtMs: 1000,
        source: 'phone-scan'
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.measurement.temperatureC).toBe(31.18);
    expect(result.value.measurement.humidityPct).toBe(44.16);
    expect(result.value.measurement.batteryPct).toBe(100);
  });

  it('rejects malformed BTHome payloads', () => {
    const result = parseBthomeV2Payload(new Uint8Array([0x40, 0x02, 0x01]), {
      sensorId: 'bad',
      seenAtMs: 1000,
      source: 'phone-scan'
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('validation-failed');
  });

  it('rejects encrypted BTHome payloads as unsupported in MVP', () => {
    const result = parseBthomeV2Payload(new Uint8Array([0x41, 0x01, 0x64]), {
      sensorId: 'encrypted',
      seenAtMs: 1000,
      source: 'phone-scan'
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('sensor-unsupported');
    expect(result.error.message).toContain('Encrypted BTHome v2');
  });

  it('keeps already parsed fields when an unknown object id follows them', () => {
    const result = parseBthomeV2Payload(new Uint8Array([0x40, 0x02, 0x56, 0x08, 0xff]), {
      sensorId: 'unknown-after-temp',
      rssi: -62,
      seenAtMs: 1000,
      source: 'phone-scan'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.confidence).toBe('medium');
    expect(result.value.measurement.temperatureC).toBe(21.34);
  });

  it('returns unsupported when unknown object ids are the only content', () => {
    const result = parseBthomeV2Payload(new Uint8Array([0x40, 0xff]), {
      sensorId: 'unknown-only',
      seenAtMs: 1000,
      source: 'phone-scan'
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('sensor-unsupported');
  });

  it('parses negative temperature fixtures', () => {
    const result = parseBthomeV2Payload(new Uint8Array([0x40, 0x02, 0x85, 0xff]), {
      sensorId: 'negative-temp',
      seenAtMs: 1000,
      source: 'phone-scan'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.measurement.temperatureC).toBe(-1.23);
  });

  it('parses BTHome voltage object id 0x0c', () => {
    const result = parseBthomeV2Payload(new Uint8Array([0x40, 0x0c, 0xb8, 0x0b]), {
      sensorId: 'voltage',
      seenAtMs: 1000,
      source: 'phone-scan'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.measurement.voltageV).toBe(3);
  });

  it('parses normalized service data from a demo advertisement', () => {
    const result = parseBthomeV2Advertisement(createDemoXiaomiAdvertisement(2000));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.measurement.source).toBe('demo');
    expect(result.value.measurement.seenAtMs).toBe(2000);
  });

  it('parses BTHome FCD2 service data from raw Android advertisements', () => {
    const result = parseBthomeV2Advertisement({
      id: 'A4:C1:38:4F:24:CD',
      name: 'LYWSD03MMC',
      rssi: -58,
      serviceUuids: [],
      serviceData: {},
      manufacturerData: {},
      rawAdvertisement: new Uint8Array([
        0x02, 0x01, 0x06, 0x0a, 0x16, 0xd2, 0xfc, 0x40, 0x02, 0x56, 0x08, 0x03, 0xd7, 0x11
      ]),
      seenAtMs: 3000,
      platform: 'android'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.measurement.temperatureC).toBe(21.34);
    expect(result.value.measurement.humidityPct).toBe(45.67);
    expect(result.value.measurement.sensorId).toBe('A4:C1:38:4F:24:CD');
  });
});

describe('DemoBleScanner', () => {
  it('normalizes demo scan results', async () => {
    const scanner = new DemoBleScanner();
    const advertisements = [];

    for await (const advertisement of scanner.startScan({ timeoutMs: 1000 })) {
      advertisements.push(advertisement);
    }

    expect(advertisements).toHaveLength(2);
    expect(advertisements[0]?.platform).toBe('demo');
    expect(advertisements[0]?.serviceData.fcd2).toBeInstanceOf(Uint8Array);
    expect(advertisements[1]?.name).toBe('TP357');
  });
});

describe('TP357 parser', () => {
  const matrixHubManufacturerData = new Uint8Array([0xc2, 0xc0, 0x00, 0x30, 0x64, 0x01]);

  it('parses MatrixHub TP357 manufacturer data', () => {
    const result = parseTp357ManufacturerData(matrixHubManufacturerData);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.temperatureC).toBe(19.2);
    expect(result.value.humidityPct).toBe(48);
    expect(result.value.batteryPct).toBe(100);
  });

  it('parses a TP357 raw advertisement fixture', () => {
    const result = parseTp357Advertisement({
      id: 'tp357',
      name: 'TP357',
      rssi: -60,
      serviceUuids: [],
      serviceData: {},
      manufacturerData: {},
      rawAdvertisement: new Uint8Array([
        0x02, 0x01, 0x06, 0x06, 0x09, 0x54, 0x50, 0x33, 0x35, 0x37, 0x07, 0xff, 0xc2,
        0xc0, 0x00, 0x30, 0x64, 0x01
      ]),
      seenAtMs: 1000,
      platform: 'web'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.profileId).toBe('tp357_custom_v1');
    expect(result.value.measurement.temperatureC).toBe(19.2);
    expect(result.value.measurement.humidityPct).toBe(48);
    expect(result.value.measurement.batteryPct).toBe(100);
    expect(result.value.measurement.source).toBe('phone-scan');
  });

  it('rebuilds MatrixHub TP357 payload when manufacturer id is separated', () => {
    const result = parseTp357Advertisement({
      id: 'tp357',
      name: 'TP357S',
      rssi: -66,
      serviceUuids: [],
      serviceData: {},
      manufacturerData: {
        c0c2: new Uint8Array([0x00, 0x30, 0x64, 0x01])
      },
      seenAtMs: 2000,
      platform: 'android'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.measurement.temperatureC).toBe(19.2);
    expect(result.value.measurement.humidityPct).toBe(48);
    expect(result.value.measurement.rssi).toBe(-66);
  });

  it('rejects malformed TP357 payloads', () => {
    const result = parseTp357ManufacturerData(new Uint8Array([0xc2, 0xc0, 0x00]));

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('validation-failed');
  });

  it('rejects advertisements without a TP357 name', () => {
    const result = parseTp357Advertisement({
      id: 'other',
      name: 'Other',
      rssi: -60,
      serviceUuids: [],
      serviceData: {},
      manufacturerData: { c0c2: new Uint8Array([0x00, 0x30, 0x64, 0x01]) },
      seenAtMs: 1000,
      platform: 'web'
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('sensor-unsupported');
  });
});
