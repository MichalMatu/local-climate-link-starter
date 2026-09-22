import {
  createDefaultShellyThermostatConfig,
  normalizeConfig
} from '@lcl/script-generator';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInstalledAutomation } from '../../features/automations/index.js';
import {
  DEFAULT_HARDWARE_SETUP_DRAFT,
  HARDWARE_SETUP_DRAFT_STORAGE_KEY,
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from './setupDraftStore.js';

describe('hardware setup Plug identity', () => {
  beforeEach(() => resetHardwareSetupDraftStore());

  it('replaces a legacy endpoint-shaped Plug id with the verified physical device id', () => {
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      shellyDevices: [
        {
          id: 'http://192.168.0.20/',
          name: 'Legacy Plug',
          baseUrl: 'http://192.168.0.20/',
          scriptIdInput: '1'
        }
      ],
      selectedShellyId: 'http://192.168.0.20/'
    });

    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'shellyplugsg3-test',
      name: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptIdInput: '1',
      model: 'S3PL-00112EU',
      gen: 3
    });

    expect(useHardwareSetupDraftStore.getState().shellyDevices).toEqual([
      {
        id: 'shellyplugsg3-test',
        name: 'Salon',
        baseUrl: 'http://192.168.0.20/',
        scriptIdInput: '1',
        model: 'S3PL-00112EU',
        gen: 3
      }
    ]);
    expect(useHardwareSetupDraftStore.getState().selectedShellyId).toBe(
      'shellyplugsg3-test'
    );
  });

  it('replaces a stale saved Plug that still owns the verified endpoint', () => {
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      shellyDevices: [
        {
          id: 'shellyplugsg3-old',
          name: 'Old Plug',
          baseUrl: 'http://192.168.0.20',
          scriptIdInput: '1'
        },
        {
          id: 'shellyplugsg3-other',
          name: 'Other Plug',
          baseUrl: 'http://192.168.0.21/',
          scriptIdInput: '1'
        }
      ],
      selectedShellyId: 'shellyplugsg3-old'
    });

    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'SHELLYPLUGSG3-TEST',
      name: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptIdInput: '1'
    });

    expect(
      useHardwareSetupDraftStore.getState().shellyDevices.map((item) => item.id)
    ).toEqual(['SHELLYPLUGSG3-TEST', 'shellyplugsg3-other']);
  });

  it('persists additional sensors and aggregation in the v9 hardware draft', () => {
    const setItem = vi.fn();
    const originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem,
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(() => null),
        length: 0
      }
    });

    try {
      useHardwareSetupDraftStore.setState({
        ...DEFAULT_HARDWARE_SETUP_DRAFT,
        sensorDevices: [
          {
            id: 'sensor-a',
            name: 'Primary',
            runtimeAddress: 'C2:C0:00:30:64:01',
            profileId: 'tp357_custom_v1'
          },
          {
            id: 'sensor-b',
            name: 'Additional',
            runtimeAddress: 'C2:C0:00:30:64:02',
            profileId: 'tp357_custom_v1'
          }
        ],
        selectedSensorId: 'sensor-a'
      });

      useHardwareSetupDraftStore.getState().setAdditionalSensorIds(['sensor-b']);
      useHardwareSetupDraftStore.getState().setSensorAggregation('max');

      const lastWrite = setItem.mock.calls.at(-1);
      expect(lastWrite?.[0]).toBe(HARDWARE_SETUP_DRAFT_STORAGE_KEY);
      const stored = JSON.parse(String(lastWrite?.[1])) as {
        selectedSensorId: string | null;
        additionalSensorIds: string[];
        inheritedSensorIds: string[];
        sensorAggregation: string;
      };
      expect(stored).toMatchObject({
        selectedSensorId: 'sensor-a',
        additionalSensorIds: ['sensor-b'],
        inheritedSensorIds: [],
        sensorAggregation: 'max'
      });
    } finally {
      if (originalLocalStorage) {
        Object.defineProperty(window, 'localStorage', originalLocalStorage);
      }
    }
  });

  it('persists configured-only provenance across a simulated edit reopen', () => {
    const primaryAddress = 'C2:C0:00:30:64:01';
    const inheritedAddress = 'C2:C0:00:30:64:02';
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const configuredSensor = (runtimeAddress: string, displayName: string) => ({
      ...base.sensor,
      sensorId: `sensor-${runtimeAddress.replaceAll(':', '').toLowerCase()}`,
      runtimeAddress,
      displayName
    });
    const installation = createInstalledAutomation({
      shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Grow plug',
      baseUrl: 'http://192.168.0.10/',
      scriptId: 1,
      scriptHash: 'script-hash',
      config: normalizeConfig({
        ...base,
        sensor: configuredSensor(primaryAddress, 'Primary'),
        sensorSet: {
          aggregation: 'avg',
          additionalSensors: [configuredSensor(inheritedAddress, 'Configured only')]
        }
      }),
      nowMs: 1000
    });

    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      sensorDevices: [
        {
          id: primaryAddress,
          name: 'Primary',
          runtimeAddress: primaryAddress,
          profileId: 'tp357_custom_v1'
        }
      ]
    });

    useHardwareSetupDraftStore.getState().loadClimateAutomationDraft(installation);

    const firstStored = JSON.parse(
      String(window.localStorage.getItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY))
    ) as typeof DEFAULT_HARDWARE_SETUP_DRAFT;
    expect(firstStored.inheritedSensorIds).toEqual([inheritedAddress]);
    expect(firstStored.sensorDevices.map((sensor) => sensor.runtimeAddress)).toEqual([
      primaryAddress,
      inheritedAddress
    ]);

    useHardwareSetupDraftStore.setState(firstStored);
    useHardwareSetupDraftStore.getState().loadClimateAutomationDraft(installation);

    expect(useHardwareSetupDraftStore.getState().inheritedSensorIds).toEqual([
      inheritedAddress
    ]);

    const reopenedStored = JSON.parse(
      String(window.localStorage.getItem(HARDWARE_SETUP_DRAFT_STORAGE_KEY))
    ) as typeof DEFAULT_HARDWARE_SETUP_DRAFT;
    expect(reopenedStored.inheritedSensorIds).toEqual([inheritedAddress]);
  });

  it('keeps an authoritative full sensor set while clearing inherited membership markers', () => {
    const addresses = [
      'C2:C0:00:30:64:01',
      'C2:C0:00:30:64:02',
      'A4:C1:38:4F:24:CD'
    ] as const;
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      sensorDevices: addresses.map((runtimeAddress, index) => ({
        id: runtimeAddress,
        name: `Sensor ${index + 1}`,
        runtimeAddress,
        profileId: 'tp357_custom_v1' as const
      })),
      selectedSensorId: addresses[0],
      inheritedSensorIds: [addresses[2]]
    });

    useHardwareSetupDraftStore
      .getState()
      .setAdditionalSensorIds([addresses[1], addresses[2]]);

    expect(useHardwareSetupDraftStore.getState().additionalSensorIds).toEqual([
      addresses[1],
      addresses[2]
    ]);
    expect(useHardwareSetupDraftStore.getState().inheritedSensorIds).toEqual([]);
  });

  it('drops recovered membership after an explicit edit even if an older draft persisted its row', () => {
    const addresses = [
      'C2:C0:00:30:64:01',
      'C2:C0:00:30:64:02',
      'C2:C0:00:30:64:03',
      'A4:C1:38:4F:24:CD'
    ] as const;
    const base = createDefaultShellyThermostatConfig('tp357_custom_v1', 'heating');
    const configuredSensor = (runtimeAddress: string, displayName: string) => ({
      ...base.sensor,
      sensorId: `sensor-${runtimeAddress.replaceAll(':', '').toLowerCase()}`,
      runtimeAddress,
      displayName
    });
    const recoveredSensor = {
      ...configuredSensor(addresses[3], 'Recovered legacy sensor'),
      sensorId: addresses[3]
    };
    const installation = createInstalledAutomation({
      shelly: { id: 'shelly-abc', model: 'S3PL-00112EU', gen: 3 },
      shellyName: 'Grow plug',
      baseUrl: 'http://192.168.0.10/',
      scriptId: 1,
      scriptHash: 'script-hash',
      config: normalizeConfig({
        ...base,
        sensor: configuredSensor(addresses[0], 'TP357 1'),
        sensorSet: {
          aggregation: 'avg',
          additionalSensors: [
            configuredSensor(addresses[1], 'TP357 2'),
            configuredSensor(addresses[2], 'TP357 3'),
            recoveredSensor
          ]
        }
      }),
      nowMs: 1000
    });

    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      sensorDevices: addresses.map((runtimeAddress, index) => ({
        id: runtimeAddress,
        name:
          index === 3 ? 'Previously persisted recovery row' : `Saved TP357 ${index + 1}`,
        runtimeAddress,
        profileId: 'tp357_custom_v1' as const
      }))
    });

    useHardwareSetupDraftStore.getState().loadClimateAutomationDraft(installation);

    expect(useHardwareSetupDraftStore.getState().additionalSensorIds).toEqual(
      addresses.slice(1)
    );

    useHardwareSetupDraftStore.getState().selectSensorDevice(addresses[1]);

    expect(useHardwareSetupDraftStore.getState().selectedSensorId).toBe(addresses[1]);
    expect(useHardwareSetupDraftStore.getState().additionalSensorIds).toEqual([
      addresses[2]
    ]);
    expect(useHardwareSetupDraftStore.getState().inheritedSensorIds).toEqual([]);
  });
});
