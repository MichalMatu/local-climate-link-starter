import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript
} from '@lcl/script-generator';
import { hashScriptCode } from '@lcl/shelly-client';
import { describe, expect, it, vi } from 'vitest';
import { createInstalledAutomation } from '../data/installedAutomation.js';
import {
  updateClimateInstalledAutomation,
  type ClimateAutomationEditServices
} from './updateClimateInstalledAutomation.js';

const originalConfig = createDefaultShellyThermostatConfig();
const installation = createInstalledAutomation({
  shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Grow plug',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'stale-development-hash',
  config: originalConfig,
  nowMs: 1000
});

const editedConfig = {
  ...originalConfig,
  rule: {
    ...originalConfig.rule,
    control: {
      ...originalConfig.rule.control,
      onThreshold: 18,
      offThreshold: 20
    }
  }
};
const editedCode = generateShellyThermostatScript(editedConfig);
const editedHash = hashScriptCode(editedCode);

const verifiedRuntime = (scriptId = 11) => ({
  script: {
    id: scriptId,
    name: 'anything',
    enable: true,
    running: true
  },
  code: editedCode,
  runtimeConfigStorageSupported: false,
  persistedRuntimeConfigJson: null,
  status: {} as never
});

const services = (
  overrides: Partial<ClimateAutomationEditServices> = {}
): ClimateAutomationEditServices => ({
  readManagedRuntime: vi.fn(async () => verifiedRuntime()),
  readDeviceId: vi.fn(async () => 'SHELLY-ABC'),
  hasNativeScheduleConflict: vi.fn(async () => false),
  forceRelayOff: vi.fn(async () => undefined),
  replaceManagedScript: vi.fn(async () => ({
    scriptId: 11,
    scriptHash: editedHash,
    running: true
  })),
  nowMs: vi.fn(() => 2000),
  ...overrides
});

describe('updateClimateInstalledAutomation', () => {
  it('always replaces the Shelly runtime and accepts a new script id', async () => {
    const mocked = services();

    const result = await updateClimateInstalledAutomation({
      installation,
      config: editedConfig,
      installations: [installation],
      services: mocked
    });

    expect(mocked.forceRelayOff).toHaveBeenCalledTimes(2);
    expect(mocked.replaceManagedScript).toHaveBeenCalledTimes(1);
    expect(mocked.replaceManagedScript).toHaveBeenCalledWith(
      installation.shelly.baseUrl,
      editedCode,
      editedConfig.output.relayId
    );
    expect(result.installation).toMatchObject({
      id: installation.id,
      installedAtMs: 1000,
      updatedAtMs: 2000,
      config: editedConfig,
      script: { id: 11, hash: editedHash }
    });
  });

  it('does not use the stored development script id or hash as edit authorization', async () => {
    const staleInstallation = {
      ...installation,
      script: { id: 999, hash: 'completely-stale' }
    };
    const mocked = services();

    await expect(
      updateClimateInstalledAutomation({
        installation: staleInstallation,
        config: editedConfig,
        installations: [staleInstallation],
        services: mocked
      })
    ).resolves.toMatchObject({
      installation: { script: { id: 11, hash: editedHash } }
    });

    expect(mocked.replaceManagedScript).toHaveBeenCalledTimes(1);
  });

  it('does not use the remote script display name as edit authorization', async () => {
    const mocked = services({
      readManagedRuntime: vi.fn(async () => ({
        ...verifiedRuntime(),
        script: { ...verifiedRuntime().script, name: 'arbitrary pre-edit name' }
      }))
    });

    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).resolves.toBeDefined();
  });

  it('refuses to mutate a different physical Shelly before relay or script mutation', async () => {
    const mocked = services({ readDeviceId: vi.fn(async () => 'other-device') });

    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('identity');

    expect(mocked.forceRelayOff).not.toHaveBeenCalled();
    expect(mocked.replaceManagedScript).not.toHaveBeenCalled();
  });

  it('refuses to replace scripts when a native Shelly schedule owns the relay', async () => {
    const mocked = services({ hasNativeScheduleConflict: vi.fn(async () => true) });

    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('native Shelly schedule');

    expect(mocked.forceRelayOff).not.toHaveBeenCalled();
    expect(mocked.replaceManagedScript).not.toHaveBeenCalled();
  });

  it('requires the freshly installed runtime to match the requested config and code hash', async () => {
    const mocked = services({
      readManagedRuntime: vi.fn(async () => ({
        ...verifiedRuntime(),
        code: generateShellyThermostatScript(originalConfig)
      }))
    });

    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('did not confirm the replaced automation runtime');

    expect(mocked.replaceManagedScript).toHaveBeenCalledTimes(1);
    expect(mocked.forceRelayOff).toHaveBeenCalledTimes(2);
  });
});
