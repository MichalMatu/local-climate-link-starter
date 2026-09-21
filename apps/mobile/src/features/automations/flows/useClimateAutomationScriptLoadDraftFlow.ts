import { DEFAULT_RULE_ADVANCED_SETTINGS } from '../data/climateRuleSettings.js';
import {
  useClimateAutomationScriptLoadFlow,
  type ClimateAutomationScriptLoadResult
} from './useClimateAutomationScriptLoadFlow.js';

const numberInput = (value: number): string => String(Number(value.toFixed(4)));

type LoadedSettings = ClimateAutomationScriptLoadResult['decoded']['settings'];
type LoadedTarget = ClimateAutomationScriptLoadResult['device'];
type LoadedStatus = ClimateAutomationScriptLoadResult['state']['status'];
type LoadedSensor = LoadedSettings['sensors'][number];

type ClimateScriptLoadDraftActions = {
  setShellyScriptId(id: string, scriptIdInput: string): void;
  selectSensorDevice(id: string): void;
  setAdditionalSensorIds(ids: readonly string[]): void;
  setSensorAggregation(value: LoadedSettings['aggregation']): void;
  setRulePreset(value: LoadedSettings['mode']): void;
  setOnThresholdInput(value: string): void;
  setOffThresholdInput(value: string): void;
  setVpdAssistEnabled(value: boolean): void;
  setVpdTargetInput(value: string): void;
  setRssiMinInput(value: string): void;
  setStaleTimeoutMinInput(value: string): void;
  setMinChangeMinInput(value: string): void;
  setMaxOnHoursInput(value: string): void;
};

type LoadDraftFlowInput = {
  getDraftActions(): ClimateScriptLoadDraftActions;
  upsertSensorDevice(device: {
    id: string;
    name: string;
    runtimeAddress: string;
    profileId: LoadedSensor['sensorProfileId'];
  }): void;
  resetInstallState(): void;
  applyControlStatus(
    device: LoadedTarget,
    status: LoadedStatus,
    message: string | null
  ): void;
  applyControlError(device: LoadedTarget, error: unknown, fallbackMessage?: string): void;
};

export const useClimateAutomationScriptLoadDraftFlow = ({
  getDraftActions,
  upsertSensorDevice,
  resetInstallState,
  applyControlStatus,
  applyControlError
}: LoadDraftFlowInput) =>
  useClimateAutomationScriptLoadFlow({
    onSuccess: ({ device, state, decoded }) => {
      const draft = getDraftActions();
      const settings = decoded.settings;
      draft.setShellyScriptId(device.id, String(state.script.id));
      settings.sensors.forEach((sensor) => {
        upsertSensorDevice({
          id: sensor.runtimeAddress,
          name: sensor.sensorDisplayName,
          runtimeAddress: sensor.runtimeAddress,
          profileId: sensor.sensorProfileId
        });
      });
      const primarySensor = settings.sensors[0];
      if (primarySensor) {
        draft.selectSensorDevice(primarySensor.runtimeAddress);
        draft.setAdditionalSensorIds(
          settings.sensors.slice(1).map((sensor) => sensor.runtimeAddress)
        );
      }
      draft.setSensorAggregation(settings.aggregation);
      draft.setRulePreset(settings.mode);
      draft.setOnThresholdInput(numberInput(settings.control.onThreshold));
      draft.setOffThresholdInput(numberInput(settings.control.offThreshold));
      draft.setVpdAssistEnabled(settings.vpdAssist.enabled);
      draft.setVpdTargetInput(
        settings.vpdAssist.targetKpa === null
          ? DEFAULT_RULE_ADVANCED_SETTINGS.vpdTargetInput
          : numberInput(settings.vpdAssist.targetKpa)
      );
      draft.setRssiMinInput(String(settings.rssiMin));
      draft.setStaleTimeoutMinInput(numberInput(settings.staleTimeoutSec / 60));
      draft.setMinChangeMinInput(numberInput(settings.minChangeMs / 60_000));
      draft.setMaxOnHoursInput(numberInput(settings.maxOnMs / 3_600_000));
      resetInstallState();
      applyControlStatus(device, state.status, null);
    },
    onError: (error, device) => applyControlError(device, error)
  });
