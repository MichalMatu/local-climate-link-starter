import { useMutation } from '@tanstack/react-query';
import {
  decodeShellyThermostatScript,
  type DecodedShellyThermostatScript
} from '@lcl/script-generator';
import { t } from '../../../app/i18n.js';
import {
  readShellyAutomationScriptState,
  type ShellyAutomationScriptState
} from '../data/shellyManagedAutomation.js';

export type ClimateAutomationScriptLoadTarget = {
  id: string;
  baseUrl: string;
};

type LoadedShellyAutomationScriptState = Omit<
  ShellyAutomationScriptState,
  'script' | 'code'
> & {
  script: NonNullable<ShellyAutomationScriptState['script']>;
  code: string;
};

export type ClimateAutomationScriptLoadResult = {
  device: ClimateAutomationScriptLoadTarget;
  state: LoadedShellyAutomationScriptState;
  decoded: DecodedShellyThermostatScript;
};

type ClimateAutomationScriptLoadCallbacks = {
  onSuccess?(result: ClimateAutomationScriptLoadResult): void;
  onError?(error: unknown, device: ClimateAutomationScriptLoadTarget): void;
};

export const useClimateAutomationScriptLoadFlow = (
  callbacks: ClimateAutomationScriptLoadCallbacks = {}
) => {
  const loadAutomationScriptMutation = useMutation({
    mutationFn: async (
      device: ClimateAutomationScriptLoadTarget
    ): Promise<ClimateAutomationScriptLoadResult> => {
      const state = await readShellyAutomationScriptState(device.baseUrl);
      if (!state.script || !state.code) {
        throw new Error(t('hardware.rule.loadScriptMissing'));
      }
      const script = state.script;
      const code = state.code;
      const decoded = decodeShellyThermostatScript(code);
      if (!decoded) {
        throw new Error(t('hardware.rule.loadScriptUnknown'));
      }
      return { device, state: { ...state, script, code }, decoded };
    },
    onSuccess: (result) => callbacks.onSuccess?.(result),
    onError: (error, device) => callbacks.onError?.(error, device)
  });

  const loadAutomationScript = (device: ClimateAutomationScriptLoadTarget) => {
    loadAutomationScriptMutation.mutate(device);
  };

  return { loadAutomationScriptMutation, loadAutomationScript };
};
