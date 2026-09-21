import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_HARDWARE_SETUP_DRAFT,
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
});
