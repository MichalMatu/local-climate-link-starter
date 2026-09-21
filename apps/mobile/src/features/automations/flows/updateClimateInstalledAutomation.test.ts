import {
  configHash,
  createDefaultShellyThermostatConfig,
  generateShellyThermostatScript,
  serializeShellyRuntimeConfig
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

const runtime = ({
  code = originalCode,
  persistedRuntimeConfigJson = null,
  runtimeConfigStorageSupported = true,
  running = true
}: {
  code?: string;
  persistedRuntimeConfigJson?: string | null;
  runtimeConfigStorageSupported?: boolean;
  running?: boolean;
} = {}) => ({
  script: {
    id: 7,
    name: LOCAL_CLIMATE_LINK_SCRIPT_NAME,
    enable: true,
    running
  },
  code,
  runtimeConfigStorageSupported,
  persistedRuntimeConfigJson,
  status: {} as never
});

const services = (
  overrides: Partial<ClimateAutomationEditServices> = {}
): ClimateAutomationEditServices => ({
  readManagedRuntime: vi
    .fn()
    .mockResolvedValueOnce(runtime())
    .mockResolvedValueOnce(
      runtime({ persistedRuntimeConfigJson: serializeShellyRuntimeConfig(editedConfig) })
    ),
  readDeviceId: vi.fn(async () => 'SHELLY-ABC'),
  hasNativeScheduleConflict: vi.fn(async () => false),
  forceRelayOff: vi.fn(async () => undefined),
  replaceManagedScript: vi.fn(async () => ({
    scriptId: 7,
    scriptHash: editedHash,
    running: true
  })),
  updateRuntimeConfig: vi.fn(async () => configHash(editedConfig)),
  nowMs: vi.fn(() => 2000),
  ...overrides
});

describe('updateClimateInstalledAutomation', () => {
  it('updates a persistence-capable runtime without replacing script code', async () => {
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
    expect(result.installation.script).toEqual(installation.script);
    expect(mocked.forceRelayOff).toHaveBeenCalledTimes(2);
    expect(mocked.updateRuntimeConfig).toHaveBeenCalledTimes(1);
    expect(mocked.updateRuntimeConfig).toHaveBeenCalledWith(
      installation.shelly.baseUrl,
      installation.script.id,
      expect.stringContaining(configHash(editedConfig))
    );
    expect(mocked.replaceManagedScript).not.toHaveBeenCalled();
  });

  it('falls back to code replacement when Script.storage is unavailable', async () => {
    const mocked = services({
      readManagedRuntime: vi
        .fn()
        .mockResolvedValueOnce(runtime({ runtimeConfigStorageSupported: false }))
        .mockResolvedValueOnce(
          runtime({
            code: editedCode,
            runtimeConfigStorageSupported: false,
            persistedRuntimeConfigJson: null
          })
        )
    });

    const result = await updateClimateInstalledAutomation({
      installation,
      config: editedConfig,
      installations: [installation],
      services: mocked
    });

    expect(result.installation.script).toEqual({ id: 7, hash: editedHash });
    expect(mocked.replaceManagedScript).toHaveBeenCalledWith(
      installation.shelly.baseUrl,
      editedCode
    );
    expect(mocked.updateRuntimeConfig).not.toHaveBeenCalled();
  });

  it('upgrades a legacy managed runtime by replacing code once', async () => {
    const legacyCode = originalCode.replace('function vc(c)', 'function oldVc(c)');
    const legacyInstallation = {
      ...installation,
      script: {
        ...installation.script,
        hash: hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${legacyCode}`)
      }
    };
    const mocked = services({
      readManagedRuntime: vi
        .fn()
        .mockResolvedValueOnce(runtime({ code: legacyCode }))
        .mockResolvedValueOnce(
          runtime({
            code: editedCode,
            persistedRuntimeConfigJson: null
          })
        )
    });

    const result = await updateClimateInstalledAutomation({
      installation: legacyInstallation,
      config: editedConfig,
      installations: [legacyInstallation],
      services: mocked
    });

    expect(result.installation.script).toEqual({ id: 7, hash: editedHash });
    expect(mocked.replaceManagedScript).toHaveBeenCalledWith(
      installation.shelly.baseUrl,
      editedCode
    );
    expect(mocked.updateRuntimeConfig).not.toHaveBeenCalled();
  });

  it('rolls back persisted config when post-update verification fails', async () => {
    const mocked = services({
      readManagedRuntime: vi
        .fn()
        .mockResolvedValueOnce(runtime())
        .mockResolvedValueOnce(runtime())
        .mockResolvedValueOnce(
          runtime({
            persistedRuntimeConfigJson: serializeShellyRuntimeConfig(originalConfig)
          })
        ),
      updateRuntimeConfig: vi
        .fn()
        .mockResolvedValueOnce(configHash(editedConfig))
        .mockResolvedValueOnce(configHash(originalConfig))
    });

    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('did not confirm');

    expect(mocked.updateRuntimeConfig).toHaveBeenCalledTimes(2);
    expect(mocked.replaceManagedScript).not.toHaveBeenCalled();
    expect(mocked.forceRelayOff).toHaveBeenCalledTimes(3);
  });

  it('reports a rollback failure explicitly', async () => {
    const mocked = services({
      readManagedRuntime: vi
        .fn()
        .mockResolvedValueOnce(runtime())
        .mockResolvedValueOnce(runtime()),
      updateRuntimeConfig: vi
        .fn()
        .mockResolvedValueOnce(configHash(editedConfig))
        .mockRejectedValueOnce(new Error('rollback failed'))
    });

    await expect(
      updateClimateInstalledAutomation({
        installation,
        config: editedConfig,
        installations: [installation],
        services: mocked
      })
    ).rejects.toThrow('rollback was not confirmed');
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
    expect(mocked.updateRuntimeConfig).not.toHaveBeenCalled();
  });

  it('refuses to overwrite a remote script that no longer matches durable ownership', async () => {
    const mocked = services({
      readManagedRuntime: vi.fn(async () => runtime({ code: 'changed elsewhere' }))
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
    expect(mocked.updateRuntimeConfig).not.toHaveBeenCalled();
  });

  it('does not accept a legacy replacement that changes the managed script id', async () => {
    const legacyCode = originalCode.replace('function vc(c)', 'function oldVc(c)');
    const legacyInstallation = {
      ...installation,
      script: {
        ...installation.script,
        hash: hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${legacyCode}`)
      }
    };
    const mocked = services({
      readManagedRuntime: vi.fn(async () => runtime({ code: legacyCode })),
      replaceManagedScript: vi.fn(async () => ({
        scriptId: 8,
        scriptHash: editedHash,
        running: true
      }))
    });
    await expect(
      updateClimateInstalledAutomation({
        installation: legacyInstallation,
        config: editedConfig,
        installations: [legacyInstallation],
        services: mocked
      })
    ).rejects.toThrow('script id');
  });

  it('does not persist success when legacy replacement verification fails', async () => {
    const legacyCode = originalCode.replace('function vc(c)', 'function oldVc(c)');
    const legacyInstallation = {
      ...installation,
      script: {
        ...installation.script,
        hash: hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${legacyCode}`)
      }
    };
    const mocked = services({
      readManagedRuntime: vi
        .fn()
        .mockResolvedValueOnce(runtime({ code: legacyCode }))
        .mockResolvedValueOnce(runtime({ code: editedCode, running: false }))
    });
    await expect(
      updateClimateInstalledAutomation({
        installation: legacyInstallation,
        config: editedConfig,
        installations: [legacyInstallation],
        services: mocked
      })
    ).rejects.toThrow('did not confirm');
  });
});
