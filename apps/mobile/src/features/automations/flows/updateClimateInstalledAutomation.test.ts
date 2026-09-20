import {
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript
} from '@lcl/script-generator';
import { hashScriptCode, LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';
import { describe, expect, it, vi } from 'vitest';
import { createInstalledAutomation } from '../data/installedAutomation.js';
import {
  updateClimateInstalledAutomation,
  type ClimateAutomationEditServices
} from './updateClimateInstalledAutomation.js';

const originalConfig = createDefaultShellyThermostatConfig();
const originalCode = generateShellyThermostatScript(originalConfig);
const installation = createInstalledAutomation({
  shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Grow plug',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${originalCode}`),
  config: originalConfig,
  nowMs: 1000
});

const editedConfig = {
  ...originalConfig,
  rule: {
    ...originalConfig.rule,
    control: { ...originalConfig.rule.control, onThreshold: 18, offThreshold: 20 }
  }
};
const editedCode = generateShellyThermostatScript(editedConfig);
const editedHash = hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${editedCode}`);

const services = (
  overrides: Partial<ClimateAutomationEditServices> = {}
): ClimateAutomationEditServices => ({
  readManagedRuntime: vi
    .fn()
    .mockResolvedValueOnce({
      script: {
        id: 7,
        name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
        enable: true,
        running: true
      },
      code: originalCode,
      status: {} as never
    })
    .mockResolvedValueOnce({
      script: {
        id: 7,
        name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
        enable: true,
        running: true
      },
      code: editedCode,
      status: {} as never
    }),
  readDeviceId: vi.fn(async () => 'SHELLY-ABC'),
  hasNativeScheduleConflict: vi.fn(async () => false),
  forceRelayOff: vi.fn(async () => undefined),
  replaceManagedScript: vi.fn(async () => ({
    scriptId: 7,
    scriptHash: editedHash,
    running: true
  })),
  nowMs: vi.fn(() => 2000),
  ...overrides
});

describe('updateClimateInstalledAutomation', () => {
  it('replaces the owned runtime and preserves durable installation identity', async () => {
    const mocked = services();
    const result = await updateClimateInstalledAutomation({
      installation,
      config: editedConfig,
      installations: [installation],
      services: mocked
    });

    expect(result.installation.id).toBe(installation.id);
    expect(result.installation.installedAtMs).toBe(1000);
    expect(result.installation.updatedAtMs).toBe(2000);
    expect(result.installation.config.rule.control).toEqual({
      ...installation.config.rule.control,
      onThreshold: 18,
      offThreshold: 20
    });
    expect(result.installation.script).toEqual({ id: 7, hash: editedHash });
    expect(mocked.forceRelayOff).toHaveBeenCalledTimes(2);
    expect(mocked.replaceManagedScript).toHaveBeenCalledWith(
      installation.shelly.baseUrl,
      editedCode
    );
  });

  it('refuses to mutate a different physical Shelly', async () => {
    const mocked = services({ readDeviceId: vi.fn(async () => 'other-device') });
    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('identity');
    expect(mocked.replaceManagedScript).not.toHaveBeenCalled();
  });

  it('refuses to overwrite a remote script that no longer matches durable ownership', async () => {
    const mocked = services({
      readManagedRuntime: vi.fn(async () => ({
        script: {
          id: 7,
          name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
          enable: true,
          running: true
        },
        code: 'changed elsewhere',
        status: {} as never
      }))
    });
    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('does not match');
    expect(mocked.replaceManagedScript).not.toHaveBeenCalled();
  });

  it('does not accept a replacement that changes the managed script id', async () => {
    const mocked = services({
      replaceManagedScript: vi.fn(async () => ({
        scriptId: 8,
        scriptHash: editedHash,
        running: true
      }))
    });
    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('script id');
  });

  it('does not persist success when post-replacement verification fails', async () => {
    const mocked = services({
      readManagedRuntime: vi
        .fn()
        .mockResolvedValueOnce({
          script: {
            id: 7,
            name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
            enable: true,
            running: true
          },
          code: originalCode,
          status: {} as never
        })
        .mockResolvedValueOnce({
          script: {
            id: 7,
            name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
            enable: true,
            running: false
          },
          code: editedCode,
          status: {} as never
        })
    });
    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('did not confirm');
  });
});
