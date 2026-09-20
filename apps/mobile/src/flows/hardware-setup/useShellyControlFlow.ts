import { createShellyTransport } from '../../platform/shellyHttpTransport.js';
import { useMutation } from '@tanstack/react-query';
import { LOCAL_CLIMATE_LINK_SCRIPT_NAME, RpcShellyClient } from '@lcl/shelly-client';
import { useCallback, useState } from 'react';
import { t } from '../../app/i18n.js';
import type { HardwareSetupStatus } from './schemas.js';
import {
  readShellyControlStatus,
  type ShellyControlStatus,
  unwrapShellyResult
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';

export type ShellyControlAction = 'status' | 'on' | 'off';

export type ShellyControlViewState = {
  status: ShellyControlStatus | null;
  pendingAction: ShellyControlAction | null;
  error: string | null;
  message: string | null;
  updatedAtMs: number | null;
};

type ShellyControlTarget = Pick<ShellyDraftDevice, 'id' | 'baseUrl'>;

type ShellyControlMutationResult = {
  device: ShellyControlTarget;
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
    device: ShellyControlTarget,
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
    device: ShellyControlTarget,
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

  const refreshShellyControlMutation = useMutation({
    mutationFn: async (
      device: ShellyControlTarget
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
      device: ShellyControlTarget
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
      device: ShellyControlTarget
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

  const refreshShellyControl = (device: ShellyControlTarget) => {
    refreshShellyControlMutation.mutate(device);
  };

  const turnRelayOn = (device: ShellyControlTarget) => {
    turnRelayOnMutation.mutate(device);
  };

  const turnRelayOff = (device: ShellyControlTarget) => {
    turnRelayOffMutation.mutate(device);
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
    refreshShellyControl,
    turnRelayOn,
    turnRelayOff,
    acknowledgeShellyControlFeedback,
    applyControlStatus,
    applyControlError,
    removeShellyControlState
  };
};
