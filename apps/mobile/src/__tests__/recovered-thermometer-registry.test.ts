import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetHardwareSetupDraftStore,
  useHardwareSetupDraftStore
} from '../flows/hardware-setup/setupDraftStore.js';

describe('recovered thermometer registry integration', () => {
  beforeEach(() => resetHardwareSetupDraftStore());

  it('merges recovered physical sensors without changing current rule membership', () => {
    const store = useHardwareSetupDraftStore.getState();
    store.upsertSensorDevice({
      id: '11:22:33:44:55:66',
      name: 'Existing primary',
      runtimeAddress: '11:22:33:44:55:66',
      profileId: 'tp357_custom_v1'
    });
    store.upsertSensorDevice({
      id: '22:33:44:55:66:77',
      name: 'Existing additional',
      runtimeAddress: '22:33:44:55:66:77',
      profileId: 'tp357_custom_v1'
    });
    useHardwareSetupDraftStore.getState().selectSensorDevice('11:22:33:44:55:66');
    useHardwareSetupDraftStore.getState().setAdditionalSensorIds(['22:33:44:55:66:77']);

    const before = useHardwareSetupDraftStore.getState();
    before.mergeRecoveredSensorDevices([
      {
        id: '11-22-33-44-55-66',
        name: 'Recovered duplicate name',
        runtimeAddress: '11-22-33-44-55-66',
        profileId: 'xiaomi_lywsd03mmc_bthome_v2'
      },
      {
        id: 'A4:C1:38:4F:24:CD',
        name: 'Recovered Xiaomi',
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        profileId: 'xiaomi_lywsd03mmc_bthome_v2'
      }
    ]);

    const after = useHardwareSetupDraftStore.getState();
    expect(after.selectedSensorId).toBe('11:22:33:44:55:66');
    expect(after.additionalSensorIds).toEqual(['22:33:44:55:66:77']);
    expect(after.sensorDevices).toHaveLength(3);
    expect(
      after.sensorDevices.find((sensor) => sensor.id === '11:22:33:44:55:66')
    ).toMatchObject({
      name: 'Existing primary',
      profileId: 'tp357_custom_v1'
    });
    expect(after.sensorDevices).toContainEqual({
      id: 'A4:C1:38:4F:24:CD',
      name: 'Recovered Xiaomi',
      runtimeAddress: 'A4:C1:38:4F:24:CD',
      profileId: 'xiaomi_lywsd03mmc_bthome_v2'
    });
  });
});
