import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { describe, expect, it } from 'vitest';
import {
  createInstalledAutomation,
  createTimeInstalledAutomation,
  findRelayOwnerConflict,
  installedAutomationRelayId
} from './model.js';

const shelly = { id: 'Shelly-ABC', model: 'S3PL-00112EU', gen: 3 };

const climateConfig = createDefaultShellyThermostatConfig(
  'xiaomi_lywsd03mmc_bthome_v2',
  'heating'
);

const climate = createInstalledAutomation({
  shelly,
  shellyName: 'Grow plug',
  baseUrl: 'http://192.168.0.20',
  scriptId: 1,
  scriptHash: 'hash',
  config: climateConfig,
  nowMs: 1
});

const time = createTimeInstalledAutomation({
  shelly,
  shellyName: 'Grow plug',
  baseUrl: 'http://192.168.0.20',
  onJobId: 7,
  offJobId: 8,
  config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
  nowMs: 2
});

describe('installed automation ownership', () => {
  it('persists climate and time automations as distinct discriminated models', () => {
    expect(climate.kind).toBe('climate');
    expect(time.kind).toBe('time');
    expect(time.id).toBe('time:shelly-abc:0');
    expect(installedAutomationRelayId(climate)).toBe(0);
    expect(installedAutomationRelayId(time)).toBe(0);
  });

  it('detects a different automation family already owning the same relay', () => {
    expect(
      findRelayOwnerConflict({
        installations: [climate],
        deviceId: 'shelly-ABC',
        relayId: 0,
        requestedKind: 'time'
      })
    ).toBe(climate);

    expect(
      findRelayOwnerConflict({
        installations: [time],
        deviceId: 'SHELLY-ABC',
        relayId: 0,
        requestedKind: 'climate'
      })
    ).toBe(time);
  });

  it('allows the same automation family to update its own relay', () => {
    expect(
      findRelayOwnerConflict({
        installations: [time],
        deviceId: 'Shelly-ABC',
        relayId: 0,
        requestedKind: 'time'
      })
    ).toBeNull();
  });
});
