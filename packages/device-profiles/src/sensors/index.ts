import type { SensorProfile } from '../schemas.js';

export const xiaomiBthomeV2Profile: SensorProfile = {
  id: 'xiaomi_lywsd03mmc_bthome_v2',
  displayName: 'Xiaomi LYWSD03MMC / PVVX BTHome v2',
  vendor: 'Xiaomi / PVVX',
  model: 'LYWSD03MMC',
  capabilities: ['ble-broadcast', 'bthome-v2', 'unencrypted-mvp'],
  requiredMeasurements: ['temperatureC', 'humidityPct'],
  compatibilityNotes: [
    'MVP expects PVVX/ATC firmware configured for unencrypted BTHome v2.',
    'Encrypted BTHome bind-key flow is outside the first skeleton.'
  ],
  safetyNotes: [
    'Runtime automation must use Shelly-side BLE readings, not phone background scans.'
  ]
};

export const tp357Profile: SensorProfile = {
  id: 'tp357_custom_v1',
  displayName: 'TP357 custom BLE beacon',
  vendor: 'ThermoPro',
  model: 'TP357',
  capabilities: ['ble-broadcast', 'thermopro-tp357'],
  requiredMeasurements: ['temperatureC', 'humidityPct'],
  compatibilityNotes: [
    'Parser follows the MatrixHub TP357 manufacturer-data model.',
    'Shelly-side hardware validation should still be recorded per firmware/device.'
  ],
  safetyNotes: [
    'Runtime automation must use Shelly-side BLE readings, not phone background scans.'
  ]
};

export const sensorProfiles = [xiaomiBthomeV2Profile, tp357Profile] as const;
