import { describe, expect, it } from 'vitest';
import type { SensorDraftDevice } from './setupDraftPersistence.js';
import { mergeRecoveredSensorRegistry } from './recoveredSensorRegistry.js';

describe('mergeRecoveredSensorRegistry', () => {
  it('adds missing recovered sensors once and preserves existing user records', () => {
    const existing: SensorDraftDevice[] = [
      {
        id: 'saved-growbox',
        name: 'My GrowBox',
        runtimeAddress: 'b8-59-ce-33-87-38',
        profileId: 'tp357_custom_v1'
      }
    ];

    const result = mergeRecoveredSensorRegistry(existing, [
      {
        id: 'B8:59:CE:33:87:38',
        name: 'Runtime name must not win',
        runtimeAddress: 'B8:59:CE:33:87:38',
        profileId: 'xiaomi_lywsd03mmc_bthome_v2'
      },
      {
        id: 'A4:C1:38:4F:24:CD',
        name: 'Recovered Xiaomi',
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        profileId: 'xiaomi_lywsd03mmc_bthome_v2'
      },
      {
        id: 'a4-c1-38-4f-24-cd',
        name: 'Duplicate recovered Xiaomi',
        runtimeAddress: 'a4-c1-38-4f-24-cd',
        profileId: 'xiaomi_lywsd03mmc_bthome_v2'
      }
    ]);

    expect(result).toEqual([
      existing[0],
      {
        id: 'A4:C1:38:4F:24:CD',
        name: 'Recovered Xiaomi',
        runtimeAddress: 'A4:C1:38:4F:24:CD',
        profileId: 'xiaomi_lywsd03mmc_bthome_v2'
      }
    ]);
  });

  it('returns the original list when recovery contains no new physical sensor', () => {
    const existing: SensorDraftDevice[] = [
      {
        id: 'B8:59:CE:33:87:38',
        name: 'GrowBox',
        runtimeAddress: 'B8:59:CE:33:87:38',
        profileId: 'tp357_custom_v1'
      }
    ];
    expect(
      mergeRecoveredSensorRegistry(existing, [
        {
          id: 'b8-59-ce-33-87-38',
          name: 'Recovered duplicate',
          runtimeAddress: 'b8-59-ce-33-87-38',
          profileId: 'tp357_custom_v1'
        }
      ])
    ).toBe(existing);
  });
});
