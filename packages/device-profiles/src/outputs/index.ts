import type { OutputProfile } from '../schemas.js';

export const shellyPlugSGen3Profile: OutputProfile = {
  id: 'shelly_plug_s_gen3',
  displayName: 'Shelly Plug S Gen3',
  vendor: 'Shelly',
  model: 'Plug S Gen3',
  capabilities: ['local-rpc', 'shelly-script', 'ble-scan', 'switch-set'],
  requiredMeasurements: ['temperatureC'],
  compatibilityNotes: [
    'Stock firmware with Shelly Scripts and Bluetooth enabled is required.',
    'Matter mode can block scripts and must stop the install flow with a clear message.'
  ],
  safetyNotes: [
    'Heating profiles default to OFF on boot, stale sensor, max ON timeout, and failed relay test.',
    'Safe relay test must end OFF before a heater or other 230 V load is connected.'
  ]
};

export const outputProfiles = [shellyPlugSGen3Profile] as const;
