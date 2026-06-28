import type {
  BleScanner,
  NormalizedBleAdvertisement,
  ParsedSensorAdvertisement,
  ScanOptions
} from '../model.js';

export const DEMO_BTHOME_PAYLOAD = new Uint8Array([
  0x40, 0x02, 0x56, 0x08, 0x03, 0xd7, 0x11, 0x01, 0x58
]);

export const createDemoXiaomiAdvertisement = (
  seenAtMs: number = Date.now()
): NormalizedBleAdvertisement => ({
  id: 'demo-xiaomi-bthome',
  name: 'LYWSD03MMC BTHome',
  rssi: -58,
  serviceUuids: ['fcd2'],
  serviceData: {
    fcd2: DEMO_BTHOME_PAYLOAD
  },
  manufacturerData: {},
  seenAtMs,
  platform: 'demo'
});

export const createDemoTp357Advertisement = (
  seenAtMs: number = Date.now()
): NormalizedBleAdvertisement => ({
  id: 'demo-tp357',
  name: 'TP357',
  rssi: -64,
  serviceUuids: [],
  serviceData: {},
  manufacturerData: {
    c0c2: new Uint8Array([0x00, 0x30, 0x64, 0x01])
  },
  rawAdvertisement: new Uint8Array([
    0x02, 0x01, 0x06, 0x06, 0x09, 0x54, 0x50, 0x33, 0x35, 0x37, 0x07, 0xff, 0xc2, 0xc0,
    0x00, 0x30, 0x64, 0x01
  ]),
  seenAtMs,
  platform: 'demo'
});

export const createDemoParsedSensors = (
  seenAtMs: number = Date.now()
): ParsedSensorAdvertisement[] => [
  {
    profileId: 'xiaomi_lywsd03mmc_bthome_v2',
    confidence: 'high',
    rawKind: 'bthome-v2',
    measurement: {
      sensorId: 'demo-xiaomi-bthome',
      source: 'demo',
      temperatureC: 21.34,
      humidityPct: 45.67,
      batteryPct: 88,
      rssi: -58,
      seenAtMs
    }
  },
  {
    profileId: 'tp357_custom_v1',
    confidence: 'low',
    rawKind: 'tp357-custom',
    measurement: {
      sensorId: 'demo-tp357',
      source: 'demo',
      temperatureC: 20.8,
      humidityPct: 48,
      batteryPct: 74,
      rssi: -64,
      seenAtMs
    }
  }
];

export class DemoBleScanner implements BleScanner {
  private stopped = false;

  async *startScan(options: ScanOptions): AsyncIterable<NormalizedBleAdvertisement> {
    void options;
    this.stopped = false;
    const seenAtMs = Date.now();
    const advertisements = [
      createDemoXiaomiAdvertisement(seenAtMs),
      createDemoTp357Advertisement(seenAtMs)
    ];

    for (const advertisement of advertisements) {
      if (this.stopped) {
        return;
      }
      yield advertisement;
    }
  }

  async stopScan(): Promise<void> {
    this.stopped = true;
  }
}
