import type {
  ShellyPlugsUiLedCapabilities,
  ShellyPlugsUiLedsConfig,
  ShellyPlugsUiLedsPatch
} from '@lcl/shelly-client';

export type PlugLedSettingsDraft = {
  mode: ShellyPlugsUiLedsConfig['mode'];
  switchOnRgb: [number, number, number] | null;
  switchOnBrightness: number;
  switchOffRgb: [number, number, number] | null;
  switchOffBrightness: number;
  powerBrightness: number;
  nightModeEnabled: boolean;
  nightBrightness: number;
  nightStart: string;
  nightEnd: string;
};

const sameRgb = (
  left: [number, number, number] | null,
  right: [number, number, number] | null
) => JSON.stringify(left) === JSON.stringify(right);

export const createPlugLedSettingsDraft = (
  config: ShellyPlugsUiLedsConfig
): PlugLedSettingsDraft => {
  const [nightStart = '22:00', nightEnd = '06:00'] =
    config.night_mode?.active_between ?? [];
  return {
    mode: config.mode,
    switchOnRgb: config.colors?.['switch:0']?.on.rgb ?? null,
    switchOnBrightness: config.colors?.['switch:0']?.on.brightness ?? 100,
    switchOffRgb: config.colors?.['switch:0']?.off.rgb ?? null,
    switchOffBrightness: config.colors?.['switch:0']?.off.brightness ?? 100,
    powerBrightness: config.colors?.power?.brightness ?? 100,
    nightModeEnabled: config.night_mode?.enable ?? false,
    nightBrightness: config.night_mode?.brightness ?? 10,
    nightStart,
    nightEnd
  };
};

export const buildPlugLedSettingsPatch = ({
  original,
  draft,
  capabilities
}: {
  original: ShellyPlugsUiLedsConfig;
  draft: PlugLedSettingsDraft;
  capabilities: ShellyPlugsUiLedCapabilities;
}): ShellyPlugsUiLedsPatch | null => {
  const patch: ShellyPlugsUiLedsPatch = {};
  if (draft.mode !== original.mode) patch.mode = draft.mode;

  const originalSwitch = original.colors?.['switch:0'];
  if (capabilities.switchColors && originalSwitch) {
    const on: { rgb?: [number, number, number] | null; brightness?: number } = {};
    const off: { rgb?: [number, number, number] | null; brightness?: number } = {};
    if (!sameRgb(draft.switchOnRgb, originalSwitch.on.rgb)) on.rgb = draft.switchOnRgb;
    if (draft.switchOnBrightness !== originalSwitch.on.brightness) {
      on.brightness = draft.switchOnBrightness;
    }
    if (!sameRgb(draft.switchOffRgb, originalSwitch.off.rgb))
      off.rgb = draft.switchOffRgb;
    if (draft.switchOffBrightness !== originalSwitch.off.brightness) {
      off.brightness = draft.switchOffBrightness;
    }
    if (Object.keys(on).length || Object.keys(off).length) {
      patch.colors = {
        'switch:0': {
          ...(Object.keys(on).length ? { on } : {}),
          ...(Object.keys(off).length ? { off } : {})
        }
      };
    }
  }

  const originalPower = original.colors?.power?.brightness;
  if (
    capabilities.powerBrightness &&
    originalPower !== undefined &&
    draft.powerBrightness !== originalPower
  ) {
    patch.colors = {
      ...(patch.colors ?? {}),
      power: { brightness: draft.powerBrightness }
    };
  }

  const originalNight = original.night_mode;
  if (capabilities.nightMode && originalNight) {
    const night: {
      enable?: boolean;
      brightness?: number;
      active_between?: [string, string];
    } = {};
    const [originalNightStart = '22:00', originalNightEnd = '06:00'] =
      originalNight.active_between;
    if (draft.nightModeEnabled !== originalNight.enable)
      night.enable = draft.nightModeEnabled;
    if (draft.nightBrightness !== originalNight.brightness) {
      night.brightness = draft.nightBrightness;
    }
    if (
      (draft.nightModeEnabled &&
        !originalNight.enable &&
        originalNight.active_between.length === 0) ||
      draft.nightStart !== originalNightStart ||
      draft.nightEnd !== originalNightEnd
    ) {
      night.active_between = [draft.nightStart, draft.nightEnd];
    }
    if (Object.keys(night).length) patch.night_mode = night;
  }

  return Object.keys(patch).length ? patch : null;
};
