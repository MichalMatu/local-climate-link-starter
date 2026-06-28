import type { SensorProfileId } from '@lcl/device-profiles';

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface BleCoreError {
  kind:
    'validation-failed' | 'sensor-unsupported' | 'ble-unavailable' | 'hardware-required';
  message: string;
  retryable: boolean;
}

export interface ScanOptions {
  serviceUuids?: string[];
  rssiMin?: number;
  timeoutMs?: number;
}

export interface NormalizedBleAdvertisement {
  id: string;
  name?: string;
  rssi?: number;
  serviceUuids: string[];
  serviceData: Record<string, Uint8Array>;
  manufacturerData: Record<string, Uint8Array>;
  rawAdvertisement?: Uint8Array;
  seenAtMs: number;
  platform: 'android' | 'ios' | 'web' | 'demo';
}

export interface BleScanner {
  startScan(options: ScanOptions): AsyncIterable<NormalizedBleAdvertisement>;
  stopScan(): Promise<void>;
}

export interface Measurement {
  sensorId: string;
  source: 'phone-scan' | 'shelly-scan' | 'demo';
  temperatureC?: number | undefined;
  humidityPct?: number | undefined;
  batteryPct?: number | undefined;
  voltageV?: number | undefined;
  rssi?: number | undefined;
  seenAtMs: number;
}

export interface ParsedSensorAdvertisement {
  profileId: SensorProfileId;
  measurement: Measurement;
  confidence: 'high' | 'medium' | 'low';
  rawKind: 'bthome-v2' | 'tp357-custom';
}

export interface BthomeParseContext {
  sensorId: string;
  rssi?: number | undefined;
  seenAtMs: number;
  source: Measurement['source'];
}
