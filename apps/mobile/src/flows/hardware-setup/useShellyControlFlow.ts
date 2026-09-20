import { unwrapShellyResult } from '../../platform/shellyResult.js';
import { createShellyTransport } from '../../platform/shellyHttpTransport.js';
import { useMutation } from '@tanstack/react-query';
import {
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  normalizeShellyDeviceId,
  RpcShellyClient
} from '@lcl/shelly-client';
import { useCallback, useState } from 'react';
import { t } from '../../app/i18n.js';
import type { HardwareSetupStatus } from './schemas.js';
import { deriveShellyInputState } from './ruleConfigDerivation.js';
import { readShellySetupStatus } from './shellyRequests.js';
import {
  readShellyControlStatus,
  reconcileInstalledAutomationsForShelly,
  type ShellyControlStatus
} from '../../features/automations/index.js';
import { useHardwareSetupDraftStore, type ShellyDraftDevice } from './setupDraftStore.js';

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

type ShellyCheckMutationInput = {
  baseUrl: string;
  name: string;
};

type ShellyCheckMutationResult = HardwareSetupStatus & {
  checkedDevice: ShellyDraftDevice;
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
  const shellyNameInput = useHardwareSetupDraftStore((state) => state.shellyNameInput);
  const shellyUrlInput = useHardwareSetupDraftStore((state) => state.shellyUrlInput);
  const upsertShellyDevice = useHardwareSetupDraftStore(
    (state) => state.upsertShellyDevice
  );
  const setShellyDeviceMetadata = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceMetadata
  );
  const [setupStatus, setSetupStatus] = useState<HardwareSetupStatus | null>(null);
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

  const checkShellyMutation = useMutation({
    mutationFn: async (
      input?: ShellyCheckMutationInput
    ): Promise<ShellyCheckMutationResult> => {
      const inputState = input
        ? deriveShellyInputState({
            shellyNameInput: input.name,
            shellyUrlInput: input.baseUrl
          })
        : deriveShellyInputState({ shellyNameInput, shellyUrlInput });
      if (!inputState.ok) {
        throw new Error(
          inputState.fieldErrors.url ??
            inputState.fieldErrors.name ??
            t('hardware.flow.fixShellyData')
        );
      }
      const { baseUrl, name } = inputState;
      const status = await readShellySetupStatus(baseUrl);
      const stableDeviceId = status.deviceInfo.id?.trim();
      if (!stableDeviceId) {
        throw new Error(t('hardware.flow.shellyIdentityMissing'));
      }
      const existingScript = status.scripts.find(
        (script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME
      );
      const checkedDevice: ShellyDraftDevice = {
        id: normalizeShellyDeviceId(stableDeviceId),
        name,
        baseUrl,
        scriptIdInput: existingScript ? String(existingScript.id) : '1',
        model: status.deviceInfo.model,
        gen: status.deviceInfo.gen
      };
      await reconcileInstalledAutomationsForShelly({
        deviceId: checkedDevice.id,
        name: checkedDevice.name,
        baseUrl: checkedDevice.baseUrl,
        model: status.deviceInfo.model,
        gen: status.deviceInfo.gen
      });
      return { ...status, checkedDevice };
    },
    onSuccess: (status) => {
      setSetupStatus(status);
      upsertShellyDevice(status.checkedDevice);
      applyControlStatus(
        status.checkedDevice,
        shellyControlStatusFromSetupStatus(status),
        null
      );
    },
    onError: () => setSetupStatus(null)
  });

  const recheckShellyMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<HardwareSetupStatus> =>
      readShellySetupStatus(device.baseUrl),
    onSuccess: (status, device) => {
      setSetupStatus(status);
      setShellyDeviceMetadata(device.id, {
        model: status.deviceInfo.model,
        gen: status.deviceInfo.gen
      });
      applyControlStatus(device, shellyControlStatusFromSetupStatus(status), null);
    },
    onError: () => setSetupStatus(null)
  });

  const resetShellySetupStatus = useCallback(() => setSetupStatus(null), []);

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
    setupStatus,
    checkShellyMutation,
    recheckShellyMutation,
    resetShellySetupStatus,
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
