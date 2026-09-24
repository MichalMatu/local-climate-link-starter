import { describe, expect, it } from 'vitest';
import {
  assertSelectedShellyIdentity,
  isHardwareInstallStateCurrent
} from './useClimateAutomationInstallFlow.js';

const installed = {
  shellyId: 'http://192.168.0.20/',
  scriptId: 1,
  scriptHash: 'hash-a'
};

describe('climate automation install state', () => {
  it('is current only for the same Shelly and script hash', () => {
    expect(
      isHardwareInstallStateCurrent(installed, 'http://192.168.0.20/', 'hash-a')
    ).toBe(true);
    expect(
      isHardwareInstallStateCurrent(installed, 'http://192.168.0.21/', 'hash-a')
    ).toBe(false);
    expect(
      isHardwareInstallStateCurrent(installed, 'http://192.168.0.20/', 'hash-b')
    ).toBe(false);
  });

  it('is not current without complete state', () => {
    expect(
      isHardwareInstallStateCurrent(null, installed.shellyId, installed.scriptHash)
    ).toBe(false);
    expect(isHardwareInstallStateCurrent(installed, null, installed.scriptHash)).toBe(
      false
    );
    expect(isHardwareInstallStateCurrent(installed, installed.shellyId, null)).toBe(
      false
    );
  });

  it('accepts normalized identity for the selected physical Shelly', () => {
    expect(() =>
      assertSelectedShellyIdentity('SHELLYPLUGSG3-A1B2C3', 'shellyplugsg3-a1b2c3')
    ).not.toThrow();
  });

  it('rejects a different physical Shelly before exclusive install', () => {
    expect(() =>
      assertSelectedShellyIdentity('shellyplugsg3-a1b2c3', 'shellyplugsg3-deadbe')
    ).toThrow('Shelly identity changed before automation install.');
  });
});
