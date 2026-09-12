import { describe, expect, it } from 'vitest';
import { isHardwareInstallStateCurrent } from './useClimateAutomationInstallFlow.js';

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
});
