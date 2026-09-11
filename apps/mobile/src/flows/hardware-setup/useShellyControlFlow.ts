import { useMutation } from '@tanstack/react-query';
import { LOCAL_CLIMATE_LINK_SCRIPT_NAME, RpcShellyClient } from '@lcl/shelly-client';
import { useCallback, useState } from 'react';
import { t } from '../../app/i18n.js';
import type { HardwareSetupStatus } from './schemas.js';
import {
  createShellyTransport,
  readShellyControlStatus,
  type ShellyControlStatus,
  unwrapShellyResult
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';

export type ShellyControlAction = 'status' | 'on' | 'off' | 'auto' | 'manual';

export type ShellyControlViewState = {
  status: ShellyControlStatus | null;
  pendingAction: ShellyControlAction | null;
  error: string | null;
  message: string | null;
  updatedAtMs: number | null;
};

type ShellyControlMutationResult = {
  device: ShellyDraftDevice;
  status: ShellyControlStatus;
};

const createInitialShellyControlState = (): ShellyControlViewState => ({
  status: null,
  pendingAction: null,
  error: null,
  message: null,
  updatedAtMs: null
});

export const shellyControlStatusFromSetupStatus = (
  status: HardwareSetupStatus
): ShellyControlStatus => {
  const automationScript =
    status.scripts.find((script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME) ??
    null;
  return {
    relayOn: status.status.relayOn,
    automationMode: automationScript
      ? automationScript.running
        ? 'auto'
        : 'manual'
      : 'missing',
    automationScriptId: automationScript?.id ?? null,
    firmwareId: status.deviceInfo.firmwareId ?? null,
    telemetry: status.status.telemetry,
    clock: status.status.clock
  };
};

export const useShellyControlFlow = () => {
  const [shellyControlStates, setShellyControlStates] = useState<
    Record<string, ShellyControlViewState>
  >({});

  const setShellyControlState = (
    deviceId: string,
    patch: Partial<ShellyControlViewState>
  ) => {
    setShellyControlStates((current) => ({
      ...current,
      [deviceId]: {
        ...(current[deviceId] ?? createInitialShellyControlState()),
        ...patch
      }
    }));
  };

  const applyControlStatus = (
    device: ShellyDraftDevice,
    status: ShellyControlStatus,
    message: string | null
  ) => {
    setShellyControlState(device.id, {
      status,
      pendingAction: null,
      error: null,
      message,
      updatedAtMs: Date.now()
    });
  };

  const applyControlError = (
    device: ShellyDraftDevice,
    error: unknown,
    fallbackMessage = t('common.operationFailed')
  ) => {
    setShellyControlState(device.id, {
      pendingAction: null,
      error: error instanceof Error ? error.message : fallbackMessage,
      message: null,
      updatedAtMs: Date.now()
    });
  };

  const requireAutomationScript = (status: ShellyControlStatus): number => {
    if (status.automationScriptId === null) {
      throw new Error(t('hardware.rule.automationScriptMissing'));
    }
    return status.automationScriptId;
  };

  const refreshShellyControlMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyControlMutationResult> => ({
      device,
      status: await readShellyControlStatus(device.baseUrl)
    }),
    onMutate: (device) =>
      setShellyControlState(device.id, {
        pendingAction: 'status',
        error: null,
        message: null
      }),
    onSuccess: ({ device, status }) => applyControlStatus(device, status, null),
    onError: (error, device) => applyControlError(device, error)
  });

  const turnRelayOnMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyControlMutationResult> => {
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(await client.setRelayOn());
      return {
        device,
        status: await readShellyControlStatus(device.baseUrl)
      };
    },
    onMutate: (device) =>
      setShellyControlState(device.id, {
        pendingAction: 'on',
        error: null,
        message: null
      }),
    onSuccess: ({ device, status }) =>
      applyControlStatus(device, status, t('hardware.flow.relayOn')),
    onError: (error, device) => applyControlError(device, error)
  });

  const turnRelayOffMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyControlMutationResult> => {
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(await client.setRelayOff());
      return {
        device,
        status: await readShellyControlStatus(device.baseUrl)
      };
    },
    onMutate: (device) =>
      setShellyControlState(device.id, {
        pendingAction: 'off',
        error: null,
        message: null
      }),
    onSuccess: ({ device, status }) =>
      applyControlStatus(device, status, t('hardware.flow.relayOff')),
    onError: (error, device) => applyControlError(device, error)
  });

  const setAutomationAutoMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyControlMutationResult> => {
      const currentStatus = await readShellyControlStatus(device.baseUrl);
      const scriptId = requireAutomationScript(currentStatus);
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(await client.startScript(scriptId));
      return {
        device,
        status: await readShellyControlStatus(device.baseUrl)
      };
    },
    onMutate: (device) =>
      setShellyControlState(device.id, {
        pendingAction: 'auto',
        error: null,
        message: null
      }),
    onSuccess: ({ device, status }) =>
      applyControlStatus(device, status, t('hardware.flow.relayAutoStarted')),
    onError: (error, device) => applyControlError(device, error)
  });

  const setAutomationManualMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyControlMutationResult> => {
      const currentStatus = await readShellyControlStatus(device.baseUrl);
      const scriptId = requireAutomationScript(currentStatus);
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      const stopResult = await client.stopScript(scriptId);
      const offResult = await client.setRelayOff();
      unwrapShellyResult(offResult);
      unwrapShellyResult(stopResult);
      return {
        device,
        status: await readShellyControlStatus(device.baseUrl)
      };
    },
    onMutate: (device) =>
      setShellyControlState(device.id, {
        pendingAction: 'manual',
        error: null,
        message: null
      }),
    onSuccess: ({ device, status }) =>
      applyControlStatus(device, status, t('hardware.flow.relayManualOff')),
    onError: (error, device) => applyControlError(device, error)
  });

  const refreshShellyControl = (device: ShellyDraftDevice) => {
    refreshShellyControlMutation.mutate(device);
  };

  const turnRelayOn = (device: ShellyDraftDevice) => {
    turnRelayOnMutation.mutate(device);
  };

  const turnRelayOff = (device: ShellyDraftDevice) => {
    turnRelayOffMutation.mutate(device);
  };

  const setAutomationAuto = (device: ShellyDraftDevice) => {
    setAutomationAutoMutation.mutate(device);
  };

  const setAutomationManual = (device: ShellyDraftDevice) => {
    setAutomationManualMutation.mutate(device);
  };

  const acknowledgeShellyControlFeedback = useCallback(
    (deviceId: string, updatedAtMs: number, message: string) => {
      setShellyControlStates((current) => {
        const controlState = current[deviceId];
        if (!controlState || controlState.updatedAtMs !== updatedAtMs) {
          return current;
        }

        const currentMessage = controlState.error ?? controlState.message;
        if (currentMessage !== message) {
          return current;
        }

        return {
          ...current,
          [deviceId]: {
            ...controlState,
            error: null,
            message: null
          }
        };
      });
    },
    []
  );

  const removeShellyControlState = useCallback((deviceId: string) => {
    setShellyControlStates((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => id !== deviceId))
    );
  }, []);

  return {
    shellyControlStates,
    refreshShellyControlMutation,
    turnRelayOnMutation,
    turnRelayOffMutation,
    setAutomationAutoMutation,
    setAutomationManualMutation,
    refreshShellyControl,
    turnRelayOn,
    turnRelayOff,
    setAutomationAuto,
    setAutomationManual,
    acknowledgeShellyControlFeedback,
    applyControlStatus,
    applyControlError,
    removeShellyControlState
  };
};
