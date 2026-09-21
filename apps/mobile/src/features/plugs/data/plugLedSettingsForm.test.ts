import { describe, expect, it } from 'vitest';
import type { ShellyPlugsUiLedsConfig } from '@lcl/shelly-client';
import {
  buildPlugLedSettingsPatch,
  createPlugLedSettingsDraft
} from './plugLedSettingsForm.js';

const config: ShellyPlugsUiLedsConfig = {
  mode: 'switch',
  colors: {
    'switch:0': {
      on: { rgb: [0, 100, 0], brightness: 100 },
      off: { rgb: [100, 0, 0], brightness: 80 }
    },
    power: { brightness: 75 }
  },
  night_mode: {
    enable: false,
    brightness: 10,
    active_between: ['22:00', '06:00']
  }
};

const capabilities = {
  switchColors: true,
  powerBrightness: true,
  nightMode: true
};

describe('Plug LED settings draft', () => {
  it('produces no patch when the editor is unchanged', () => {
    expect(
      buildPlugLedSettingsPatch({
        original: config,
        draft: createPlugLedSettingsDraft(config),
        capabilities
      })
    ).toBeNull();
  });

  it('produces a deep partial patch for only changed leaves', () => {
    const draft = createPlugLedSettingsDraft(config);
    draft.switchOnBrightness = 35;
    draft.nightModeEnabled = true;
    draft.nightStart = '23:30';

    expect(buildPlugLedSettingsPatch({ original: config, draft, capabilities })).toEqual({
      colors: { 'switch:0': { on: { brightness: 35 } } },
      night_mode: { enable: true, active_between: ['23:30', '06:00'] }
    });
  });

  it('preserves an empty disabled night window until the user enables or edits it', () => {
    const realDeviceConfig: ShellyPlugsUiLedsConfig = {
      mode: 'switch',
      night_mode: { enable: false, brightness: 100, active_between: [] }
    };
    const draft = createPlugLedSettingsDraft(realDeviceConfig);
    expect(draft.nightStart).toBe('22:00');
    expect(draft.nightEnd).toBe('06:00');

    draft.nightBrightness = 7;
    expect(
      buildPlugLedSettingsPatch({ original: realDeviceConfig, draft, capabilities })
    ).toEqual({ night_mode: { brightness: 7 } });

    draft.nightModeEnabled = true;
    expect(
      buildPlugLedSettingsPatch({ original: realDeviceConfig, draft, capabilities })
    ).toEqual({
      night_mode: {
        enable: true,
        brightness: 7,
        active_between: ['22:00', '06:00']
      }
    });
  });

  it('does not write optional subtrees the device did not expose', () => {
    const minimal: ShellyPlugsUiLedsConfig = { mode: 'off' };
    const draft = createPlugLedSettingsDraft(minimal);
    draft.mode = 'power';
    draft.nightModeEnabled = true;

    expect(
      buildPlugLedSettingsPatch({
        original: minimal,
        draft,
        capabilities: {
          switchColors: false,
          powerBrightness: false,
          nightMode: false
        }
      })
    ).toEqual({ mode: 'power' });
  });
});
