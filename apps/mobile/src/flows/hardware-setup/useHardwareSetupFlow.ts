import { useMutation } from '@tanstack/react-query';
import { defaultRuleForPreset, type RulePresetId } from '@lcl/automation-core';
import { CapacitorBleScanner, type BleScanner } from '@lcl/ble-core';
import {
  createDefaultShellyThermostatConfig,
  generateShellyBleDiscoveryScript,
  generateShellyThermostatScript,
  type ShellyThermostatConfig
} from '@lcl/script-generator';
import {
  createInstallPlan,
  hashScriptCode,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RPC_METHODS,
  RpcShellyClient,
  scriptStatusSchema,
  type RelayTestResult,
  type ShellyInstallResult
} from '@lcl/shelly-client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { t } from '../../app/i18n.js';
import {
  type BleDiscoveryCandidate,
  type BleDiscoverySnapshot,
  diagnosticSnapshotSchema,
  type HardwareDiagnosticSnapshot,
  type HardwareSetupStatus
} from './schemas.js';
import {
  cleanupStaleShellyBleDiscoveryScripts,
  createShellyTransport,
  deleteShellyAutomationScript,
  fetchShellyJson,
  installShellyBleDiscoveryScript,
  prepareShellyBleDiscovery,
  readShellyAutomationScriptState,
  readShellyBleDiscoverySnapshot,
  readShellyControlStatus,
  readShellySetupStatus,
  restartShellyBleDiscoveryScan,
  scanShellySetupUrls,
  stopShellyBleDiscovery,
  type ShellyAutomationScriptState,
  type ShellyControlStatus,
  type ShellySetupScanOutcome,
  unwrapShellyResult
} from './shellyRequests.js';
import {
  useHardwareSetupDraftStore,
  type SensorDraftDevice,
  type ShellyDraftDevice
} from './setupDraftStore.js';
import {
  mergeBleDiscoveryCandidate,
  scanPhoneBleSensors,
  type PhoneBleScanOutcome
} from './phoneBleScan.js';
import {
  createIpv4RangeScanUrls,
  formatSensorId,
  normalizeRuntimeAddress,
  normalizeShellyUrl,
  toNumberOrFallback
} from './validation.js';
import {
  parseRuleAdvancedSettings,
  validateRuleAdvancedSettings
} from './ruleAdvancedSettings.js';

type ConfigState =
  | { ok: true; config: ShellyThermostatConfig; script: string }
  | { ok: false; error: string };

type ShellyCheckMutationResult = HardwareSetupStatus & {
  checkedDevice: ShellyDraftDevice;
};

type ShellyInputState =
  | { ok: true; baseUrl: string; name: string }
  | { ok: false; fieldErrors: { name?: string; url?: string } };

type SensorInputState =
  | { ok: true; device: SensorDraftDevice }
  | { ok: false; fieldErrors: { name?: string; mac?: string } };

type BleDiscoverySession = {
  shellyId: string;
  baseUrl: string;
  discoveryScriptId: number;
  automationScriptId: number | null;
  automationWasRunning: boolean;
};

type StartBleDiscoveryResult = {
  session: BleDiscoverySession;
  snapshot: BleDiscoverySnapshot;
};

type ShellyControlAction = 'status' | 'on' | 'off' | 'auto' | 'manual';

type ShellyControlViewState = {
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

type ShellyAutomationScriptViewState = ShellyAutomationScriptState & {
  deviceId: string;
  updatedAtMs: number;
};

type ShellyAutomationScriptMutationResult = {
  device: ShellyDraftDevice;
  state: ShellyAutomationScriptState;
};

type ShellyAutomationDeleteMutationResult = {
  device: ShellyDraftDevice;
  status: ShellyControlStatus;
};

type HardwareInstallState = {
  shellyId: string;
  scriptId: number;
  scriptHash: string;
};

type SafeRelayTestMutationResult = {
  install: HardwareInstallState;
  relayTest: RelayTestResult;
};

const createInitialShellyControlState = (): ShellyControlViewState => ({
  status: null,
  pendingAction: null,
  error: null,
  message: null,
  updatedAtMs: null
});

const diagnosticScriptStatusMessage = async (
  baseUrl: string,
  scriptId: number
): Promise<string | null> => {
  const response = await createShellyTransport(baseUrl).call<unknown>({
    method: RPC_METHODS.ScriptGetStatus,
    params: { id: scriptId }
  });
  if (!response.ok) {
    return null;
  }

  const parsed = scriptStatusSchema.safeParse(unwrapShellyResult(response));
  if (
    !parsed.success ||
    parsed.data.running === true ||
    (parsed.data.running === undefined &&
      parsed.data.error === undefined &&
      parsed.data.errors === undefined)
  ) {
    return null;
  }

  const status = parsed.data.errors?.map(String).join(', ') || 'stopped';
  return status.includes('out_of_memory')
    ? t('hardware.diagnostics.scriptOutOfMemory')
    : t('hardware.diagnostics.scriptNotRunning', { status });
};

export const useHardwareSetupFlow = () => {
  const shellyNameInput = useHardwareSetupDraftStore((state) => state.shellyNameInput);
  const setShellyNameInput = useHardwareSetupDraftStore(
    (state) => state.setShellyNameInput
  );
  const shellyUrlInput = useHardwareSetupDraftStore((state) => state.shellyUrlInput);
  const setShellyUrlInputDraft = useHardwareSetupDraftStore(
    (state) => state.setShellyUrlInput
  );
  const shellyDevices = useHardwareSetupDraftStore((state) => state.shellyDevices);
  const selectedShellyId = useHardwareSetupDraftStore((state) => state.selectedShellyId);
  const selectShellyDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.selectShellyDevice
  );
  const setShellyDeviceName = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceName
  );
  const setShellyScriptIdDraft = useHardwareSetupDraftStore(
    (state) => state.setShellyScriptId
  );
  const removeShellyDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.removeShellyDevice
  );
  const upsertShellyDevice = useHardwareSetupDraftStore(
    (state) => state.upsertShellyDevice
  );
  const sensorMacInput = useHardwareSetupDraftStore((state) => state.sensorMacInput);
  const setSensorMacInput = useHardwareSetupDraftStore(
    (state) => state.setSensorMacInput
  );
  const sensorProfileInput = useHardwareSetupDraftStore(
    (state) => state.sensorProfileInput
  );
  const setSensorProfileInput = useHardwareSetupDraftStore(
    (state) => state.setSensorProfileInput
  );
  const sensorNameInput = useHardwareSetupDraftStore((state) => state.sensorNameInput);
  const setSensorNameInput = useHardwareSetupDraftStore(
    (state) => state.setSensorNameInput
  );
  const sensorDevices = useHardwareSetupDraftStore((state) => state.sensorDevices);
  const selectedSensorId = useHardwareSetupDraftStore((state) => state.selectedSensorId);
  const selectSensorDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.selectSensorDevice
  );
  const setSensorDeviceName = useHardwareSetupDraftStore(
    (state) => state.setSensorDeviceName
  );
  const removeSensorDeviceDraft = useHardwareSetupDraftStore(
    (state) => state.removeSensorDevice
  );
  const upsertSensorDevice = useHardwareSetupDraftStore(
    (state) => state.upsertSensorDevice
  );
  const diagnosticShellyId = useHardwareSetupDraftStore(
    (state) => state.diagnosticShellyId
  );
  const setDiagnosticShellyIdDraft = useHardwareSetupDraftStore(
    (state) => state.setDiagnosticShellyId
  );
  const rulePreset = useHardwareSetupDraftStore((state) => state.rulePreset);
  const setRulePreset = useHardwareSetupDraftStore((state) => state.setRulePreset);
  const onThresholdInput = useHardwareSetupDraftStore((state) => state.onThresholdInput);
  const setOnThresholdInput = useHardwareSetupDraftStore(
    (state) => state.setOnThresholdInput
  );
  const offThresholdInput = useHardwareSetupDraftStore(
    (state) => state.offThresholdInput
  );
  const setOffThresholdInput = useHardwareSetupDraftStore(
    (state) => state.setOffThresholdInput
  );
  const vpdAssistEnabled = useHardwareSetupDraftStore((state) => state.vpdAssistEnabled);
  const setVpdAssistEnabled = useHardwareSetupDraftStore(
    (state) => state.setVpdAssistEnabled
  );
  const vpdTargetInput = useHardwareSetupDraftStore((state) => state.vpdTargetInput);
  const setVpdTargetInput = useHardwareSetupDraftStore(
    (state) => state.setVpdTargetInput
  );
  const rssiMinInput = useHardwareSetupDraftStore((state) => state.rssiMinInput);
  const setRssiMinInput = useHardwareSetupDraftStore((state) => state.setRssiMinInput);
  const staleTimeoutMinInput = useHardwareSetupDraftStore(
    (state) => state.staleTimeoutMinInput
  );
  const setStaleTimeoutMinInput = useHardwareSetupDraftStore(
    (state) => state.setStaleTimeoutMinInput
  );
  const minChangeMinInput = useHardwareSetupDraftStore(
    (state) => state.minChangeMinInput
  );
  const setMinChangeMinInput = useHardwareSetupDraftStore(
    (state) => state.setMinChangeMinInput
  );
  const maxOnHoursInput = useHardwareSetupDraftStore((state) => state.maxOnHoursInput);
  const setMaxOnHoursInput = useHardwareSetupDraftStore(
    (state) => state.setMaxOnHoursInput
  );
  const [setupStatus, setSetupStatus] = useState<HardwareSetupStatus | null>(null);
  const [diagnosticSnapshot, setDiagnosticSnapshot] =
    useState<HardwareDiagnosticSnapshot | null>(null);
  const [shellyScanStartInput, setShellyScanStartInput] = useState('192.168.0.1');
  const [shellyScanEndInput, setShellyScanEndInput] = useState('192.168.0.99');
  const [shellyScanStopped, setShellyScanStopped] = useState(false);
  const shellyScanAbortControllerRef = useRef<AbortController | null>(null);
  const [bleDiscoverySession, setBleDiscoverySession] =
    useState<BleDiscoverySession | null>(null);
  const [bleDiscoverySnapshot, setBleDiscoverySnapshot] =
    useState<BleDiscoverySnapshot | null>(null);
  const [phoneBleScanCandidates, setPhoneBleScanCandidates] = useState<
    BleDiscoveryCandidate[]
  >([]);
  const phoneBleScannerRef = useRef<BleScanner | null>(null);
  const [shellyControlStates, setShellyControlStates] = useState<
    Record<string, ShellyControlViewState>
  >({});
  const [automationScriptState, setAutomationScriptState] =
    useState<ShellyAutomationScriptViewState | null>(null);
  const [lastInstallState, setLastInstallState] = useState<HardwareInstallState | null>(
    null
  );
  const [safeRelayTestState, setSafeRelayTestState] =
    useState<HardwareInstallState | null>(null);

  const updateShellyUrlInput = (value: string) => {
    setShellyUrlInputDraft(value);
    setSetupStatus(null);
    setDiagnosticSnapshot(null);
  };

  const selectedShelly = useMemo(
    () => shellyDevices.find((device) => device.id === selectedShellyId) ?? null,
    [selectedShellyId, shellyDevices]
  );
  const selectedSensor = useMemo(
    () => sensorDevices.find((device) => device.id === selectedSensorId) ?? null,
    [selectedSensorId, sensorDevices]
  );
  const diagnosticShelly = useMemo(
    () => shellyDevices.find((device) => device.id === diagnosticShellyId) ?? null,
    [diagnosticShellyId, shellyDevices]
  );
  const shellyBaseUrl = useMemo(() => {
    return selectedShelly?.baseUrl ?? null;
  }, [selectedShelly]);
  const savedShellyScanBaseUrls = useMemo(() => {
    const baseUrls = new Set<string>();
    for (const device of shellyDevices) {
      try {
        baseUrls.add(normalizeShellyUrl(device.baseUrl));
      } catch {
        baseUrls.add(device.baseUrl);
      }
    }
    return baseUrls;
  }, [shellyDevices]);

  const shellyInputState = useMemo((): ShellyInputState => {
    const fieldErrors: { name?: string; url?: string } = {};
    const name = shellyNameInput.trim();
    if (name.length === 0) {
      fieldErrors.name = t('hardware.validation.shellyNameRequired');
    }

    let baseUrl = '';
    try {
      baseUrl = normalizeShellyUrl(shellyUrlInput);
    } catch (error) {
      fieldErrors.url =
        error instanceof Error ? error.message : t('hardware.validation.shellyIpFormat');
    }

    if (fieldErrors.name || fieldErrors.url) {
      return { ok: false, fieldErrors };
    }

    return { ok: true, baseUrl, name };
  }, [shellyNameInput, shellyUrlInput]);

  const sensorInputState = useMemo((): SensorInputState => {
    const fieldErrors: { name?: string; mac?: string } = {};
    const name = sensorNameInput.trim();
    if (name.length === 0) {
      fieldErrors.name = t('hardware.validation.sensorNameRequired');
    }

    let runtimeAddress = '';
    if (sensorMacInput.trim().length === 0) {
      fieldErrors.mac = t('hardware.validation.sensorMacRequired');
    } else {
      try {
        runtimeAddress = normalizeRuntimeAddress(sensorMacInput);
      } catch (error) {
        fieldErrors.mac =
          error instanceof Error
            ? error.message
            : t('hardware.validation.sensorMacFormat');
      }
    }

    if (fieldErrors.name || fieldErrors.mac) {
      return { ok: false, fieldErrors };
    }

    return {
      ok: true,
      device: {
        id: runtimeAddress,
        name,
        runtimeAddress,
        profileId: sensorProfileInput
      }
    };
  }, [sensorMacInput, sensorNameInput, sensorProfileInput]);

  const addSensorDraft = () => {
    if (sensorInputState.ok) {
      upsertSensorDevice(sensorInputState.device);
    }
  };

  const advancedSettingsValidation = useMemo(
    () =>
      validateRuleAdvancedSettings({
        vpdAssistEnabled,
        vpdTargetInput,
        rssiMinInput,
        staleTimeoutMinInput,
        minChangeMinInput,
        maxOnHoursInput
      }),
    [
      maxOnHoursInput,
      minChangeMinInput,
      rssiMinInput,
      staleTimeoutMinInput,
      vpdAssistEnabled,
      vpdTargetInput
    ]
  );

  const configState: ConfigState = useMemo(() => {
    try {
      if (!selectedSensor) {
        throw new Error(t('hardware.flow.noSelectedSensor'));
      }
      if (!advancedSettingsValidation.isValid) {
        throw new Error(t('hardware.flow.advancedOptionsInvalid'));
      }
      const base = createDefaultShellyThermostatConfig(
        selectedSensor.profileId,
        rulePreset
      );
      const advancedSettings = parseRuleAdvancedSettings({
        vpdAssistEnabled,
        vpdTargetInput,
        rssiMinInput,
        staleTimeoutMinInput,
        minChangeMinInput,
        maxOnHoursInput
      });
      const config: ShellyThermostatConfig = {
        ...base,
        sensor: {
          ...base.sensor,
          sensorId: formatSensorId(
            selectedSensor.profileId,
            selectedSensor.runtimeAddress
          ),
          runtimeAddress: selectedSensor.runtimeAddress,
          displayName: selectedSensor.name
        },
        rule: {
          ...base.rule,
          control: {
            ...base.rule.control,
            onThreshold: toNumberOrFallback(
              onThresholdInput,
              base.rule.control.onThreshold
            ),
            offThreshold: toNumberOrFallback(
              offThresholdInput,
              base.rule.control.offThreshold
            )
          },
          vpdAssist: {
            enabled: vpdAssistEnabled,
            targetKpa: advancedSettings.vpdTargetKpa
          },
          staleTimeoutSec: advancedSettings.staleTimeoutSec,
          minChangeMs: advancedSettings.minChangeMs,
          maxOnMs: advancedSettings.maxOnMs,
          rssiMin: advancedSettings.rssiMin
        }
      };

      return {
        ok: true,
        config,
        script: generateShellyThermostatScript(config)
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : t('hardware.flow.configInvalid')
      };
    }
  }, [
    advancedSettingsValidation.isValid,
    maxOnHoursInput,
    minChangeMinInput,
    offThresholdInput,
    onThresholdInput,
    rssiMinInput,
    rulePreset,
    selectedSensor,
    staleTimeoutMinInput,
    vpdAssistEnabled,
    vpdTargetInput
  ]);

  const isThresholdValid = useMemo(() => {
    const onThreshold = Number(onThresholdInput);
    const offThreshold = Number(offThresholdInput);
    if (!Number.isFinite(onThreshold) || !Number.isFinite(offThreshold)) {
      return false;
    }
    const direction = defaultRuleForPreset(rulePreset).control.direction;
    return direction === 'below'
      ? onThreshold < offThreshold
      : onThreshold > offThreshold;
  }, [offThresholdInput, onThresholdInput, rulePreset]);

  const isVpdAssistValid = advancedSettingsValidation.isVpdTargetValid;
  const currentScriptHash = useMemo(
    () =>
      configState.ok
        ? hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${configState.script}`)
        : null,
    [configState]
  );
  const isLastInstallCurrent =
    lastInstallState !== null &&
    selectedShelly !== null &&
    currentScriptHash !== null &&
    lastInstallState.shellyId === selectedShelly.id &&
    lastInstallState.scriptHash === currentScriptHash;
  const isSafeRelayTestComplete =
    safeRelayTestState !== null &&
    selectedShelly !== null &&
    currentScriptHash !== null &&
    safeRelayTestState.shellyId === selectedShelly.id &&
    safeRelayTestState.scriptHash === currentScriptHash;
  const canRunSafeRelayTest = isLastInstallCurrent && !isSafeRelayTestComplete;

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

  const controlStatusFromSetupStatus = (
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

  const checkShellyMutation = useMutation({
    mutationFn: async (): Promise<ShellyCheckMutationResult> => {
      if (!shellyInputState.ok) {
        throw new Error(
          shellyInputState.fieldErrors.url ??
            shellyInputState.fieldErrors.name ??
            t('hardware.flow.fixShellyData')
        );
      }
      const { baseUrl, name } = shellyInputState;
      const status = await readShellySetupStatus(baseUrl);
      const existingScript = status.scripts.find(
        (script) => script.name === LOCAL_CLIMATE_LINK_SCRIPT_NAME
      );
      return {
        ...status,
        checkedDevice: {
          id: baseUrl,
          name,
          baseUrl,
          scriptIdInput: existingScript ? String(existingScript.id) : '1'
        }
      };
    },
    onSuccess: (status) => {
      setSetupStatus(status);
      upsertShellyDevice(status.checkedDevice);
      applyControlStatus(
        status.checkedDevice,
        controlStatusFromSetupStatus(status),
        null
      );
    },
    onError: () => {
      setSetupStatus(null);
    }
  });

  const recheckShellyMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<HardwareSetupStatus> =>
      readShellySetupStatus(device.baseUrl),
    onSuccess: (status, device) => {
      setSetupStatus(status);
      applyControlStatus(device, controlStatusFromSetupStatus(status), null);
    },
    onError: () => {
      setSetupStatus(null);
    }
  });

  const shellyScanMutation = useMutation({
    mutationFn: async (): Promise<ShellySetupScanOutcome> => {
      setShellyScanStopped(false);
      const controller = new AbortController();
      shellyScanAbortControllerRef.current = controller;
      try {
        const baseUrls = createIpv4RangeScanUrls(
          shellyScanStartInput,
          shellyScanEndInput
        ).filter((baseUrl) => !savedShellyScanBaseUrls.has(baseUrl));
        return await scanShellySetupUrls({
          baseUrls,
          signal: controller.signal
        });
      } finally {
        if (shellyScanAbortControllerRef.current === controller) {
          shellyScanAbortControllerRef.current = null;
        }
      }
    }
  });

  const startShellyScan = () => {
    setShellyScanStopped(false);
    shellyScanMutation.mutate();
  };

  const stopShellyScan = () => {
    const controller = shellyScanAbortControllerRef.current;
    if (!controller || controller.signal.aborted) {
      return false;
    }
    setShellyScanStopped(true);
    controller.abort();
    shellyScanAbortControllerRef.current = null;
    shellyScanMutation.reset();
    return true;
  };

  const resetShellyScan = () => {
    stopShellyScan();
    setShellyScanStopped(false);
    shellyScanMutation.reset();
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

  const fetchAutomationScriptMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyAutomationScriptMutationResult> => ({
      device,
      state: await readShellyAutomationScriptState(device.baseUrl)
    }),
    onSuccess: ({ device, state }) => {
      setAutomationScriptState({
        ...state,
        deviceId: device.id,
        updatedAtMs: Date.now()
      });
      applyControlStatus(device, state.status, null);
    },
    onError: (error, device) => applyControlError(device, error)
  });

  const deleteAutomationScriptMutation = useMutation({
    mutationFn: async (
      device: ShellyDraftDevice
    ): Promise<ShellyAutomationDeleteMutationResult> => ({
      device,
      status: await deleteShellyAutomationScript(device.baseUrl)
    }),
    onSuccess: ({ device, status }) => {
      setShellyScriptIdDraft(device.id, '1');
      setAutomationScriptState({
        deviceId: device.id,
        script: null,
        code: null,
        status,
        updatedAtMs: Date.now()
      });
      applyControlStatus(device, status, t('hardware.flow.scriptDeleted'));
    },
    onError: (error, device) => applyControlError(device, error)
  });

  const fetchAutomationScript = (device: ShellyDraftDevice) => {
    fetchAutomationScriptMutation.mutate(device);
  };

  const deleteAutomationScript = (device: ShellyDraftDevice) => {
    deleteAutomationScriptMutation.mutate(device);
  };

  const startBleDiscoveryMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<StartBleDiscoveryResult> => {
      let preparation: Awaited<ReturnType<typeof prepareShellyBleDiscovery>> | null =
        null;
      let discoveryScriptId: number | null = null;

      try {
        preparation = await prepareShellyBleDiscovery(device.baseUrl);
        const installResult = await installShellyBleDiscoveryScript(
          device.baseUrl,
          generateShellyBleDiscoveryScript()
        );
        discoveryScriptId = installResult.scriptId;
        const session: BleDiscoverySession = {
          shellyId: device.id,
          baseUrl: device.baseUrl,
          discoveryScriptId: installResult.scriptId,
          automationScriptId: preparation.automationScriptId,
          automationWasRunning: preparation.automationWasRunning
        };
        const snapshot = await readShellyBleDiscoverySnapshot(
          device.baseUrl,
          installResult.scriptId
        );

        return { session, snapshot };
      } catch (error) {
        if (preparation) {
          try {
            await stopShellyBleDiscovery(device.baseUrl, {
              discoveryScriptId,
              automationScriptId: preparation.automationScriptId,
              restartAutomation: preparation.automationWasRunning
            });
          } catch (cleanupError) {
            const message =
              error instanceof Error
                ? error.message
                : t('hardware.flow.bleScanStartFailed');
            const cleanupMessage =
              cleanupError instanceof Error
                ? cleanupError.message
                : t('hardware.flow.bleScanCleanupFailed');
            throw new Error(`${message} ${cleanupMessage}`);
          }
        }
        throw error;
      }
    },
    onSuccess: ({ session, snapshot }) => {
      setBleDiscoverySession(session);
      setBleDiscoverySnapshot(snapshot);
    },
    onError: () => {
      setBleDiscoverySession(null);
      setBleDiscoverySnapshot(null);
    }
  });

  const refreshBleDiscoveryMutation = useMutation({
    mutationFn: async (session: BleDiscoverySession): Promise<BleDiscoverySnapshot> =>
      readShellyBleDiscoverySnapshot(session.baseUrl, session.discoveryScriptId),
    onSuccess: (snapshot) => setBleDiscoverySnapshot(snapshot)
  });

  const restartBleDiscoveryMutation = useMutation({
    mutationFn: async (session: BleDiscoverySession): Promise<BleDiscoverySnapshot> => {
      await restartShellyBleDiscoveryScan(session.baseUrl, session.discoveryScriptId);
      return readShellyBleDiscoverySnapshot(session.baseUrl, session.discoveryScriptId);
    },
    onSuccess: (snapshot) => setBleDiscoverySnapshot(snapshot)
  });

  const stopBleDiscoveryMutation = useMutation({
    mutationFn: async (session: BleDiscoverySession): Promise<void> =>
      stopShellyBleDiscovery(session.baseUrl, {
        discoveryScriptId: session.discoveryScriptId,
        automationScriptId: session.automationScriptId,
        restartAutomation: session.automationWasRunning
      }),
    onSuccess: () => setBleDiscoverySession(null)
  });

  const startBleDiscovery = (device: ShellyDraftDevice) => {
    setBleDiscoverySnapshot(null);
    setBleDiscoverySession(null);
    refreshBleDiscoveryMutation.reset();
    stopBleDiscoveryMutation.reset();
    startBleDiscoveryMutation.mutate(device);
  };

  const refreshBleDiscovery = () => {
    if (!bleDiscoverySession) {
      return;
    }
    refreshBleDiscoveryMutation.mutate(bleDiscoverySession);
  };

  const restartBleDiscovery = () => {
    if (!bleDiscoverySession || restartBleDiscoveryMutation.isPending) {
      return;
    }
    refreshBleDiscoveryMutation.reset();
    restartBleDiscoveryMutation.reset();
    restartBleDiscoveryMutation.mutate(bleDiscoverySession);
  };

  const stopBleDiscovery = () => {
    if (!bleDiscoverySession || stopBleDiscoveryMutation.isPending) {
      return;
    }
    stopBleDiscoveryMutation.mutate(bleDiscoverySession);
  };

  const cleanupBleDiscovery = () => {
    if (!bleDiscoverySession || stopBleDiscoveryMutation.isPending) {
      return;
    }
    stopBleDiscoveryMutation.mutate(bleDiscoverySession);
  };

  const resetBleDiscovery = () => {
    setBleDiscoverySnapshot(null);
    startBleDiscoveryMutation.reset();
    refreshBleDiscoveryMutation.reset();
    restartBleDiscoveryMutation.reset();
    stopBleDiscoveryMutation.reset();
  };

  const upsertPhoneBleScanCandidate = (candidate: BleDiscoveryCandidate) => {
    setPhoneBleScanCandidates((current) =>
      mergeBleDiscoveryCandidate(current, candidate)
    );
  };

  const phoneBleScanMutation = useMutation({
    mutationFn: async (): Promise<PhoneBleScanOutcome> => {
      const scanner = new CapacitorBleScanner();
      phoneBleScannerRef.current = scanner;
      setPhoneBleScanCandidates([]);

      try {
        return await scanPhoneBleSensors({
          scanner,
          onCandidate: upsertPhoneBleScanCandidate
        });
      } finally {
        if (phoneBleScannerRef.current === scanner) {
          phoneBleScannerRef.current = null;
        }
      }
    },
    onSuccess: (outcome) => setPhoneBleScanCandidates(outcome.candidates)
  });

  const startPhoneBleScan = () => {
    phoneBleScanMutation.reset();
    phoneBleScanMutation.mutate();
  };

  const stopPhoneBleScan = () => {
    void phoneBleScannerRef.current?.stopScan();
  };

  const resetPhoneBleScan = () => {
    stopPhoneBleScan();
    setPhoneBleScanCandidates([]);
    phoneBleScanMutation.reset();
  };

  const addDiscoveredSensor = (candidate: BleDiscoveryCandidate) => {
    const runtimeAddress = normalizeRuntimeAddress(candidate.runtimeAddress);
    const name = t('hardware.flow.sensorDefaultName', {
      suffix: runtimeAddress.split(':').slice(-2).join(':')
    });
    upsertSensorDevice({
      id: runtimeAddress,
      name,
      runtimeAddress,
      profileId: candidate.profileId
    });
  };

  const fetchDiagnostics = async (
    scriptId = Math.trunc(toNumberOrFallback(diagnosticShelly?.scriptIdInput ?? '1', 1))
  ): Promise<HardwareDiagnosticSnapshot> => {
    if (!diagnosticShelly) {
      throw new Error(t('hardware.flow.noSelectedDiagnosticShelly'));
    }
    const endpoint = new URL(`/script/${scriptId}/diag`, diagnosticShelly.baseUrl);
    try {
      const payload = await fetchShellyJson(endpoint, 5000);
      const parsed = diagnosticSnapshotSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.message);
      }
      return parsed.data;
    } catch {
      const scriptStatusMessage = await diagnosticScriptStatusMessage(
        diagnosticShelly.baseUrl,
        scriptId
      ).catch(() => null);
      throw new Error(scriptStatusMessage ?? t('hardware.diagnostics.readFailed'));
    }
  };

  const diagnosticMutation = useMutation({
    mutationFn: fetchDiagnostics,
    onSuccess: (snapshot) => setDiagnosticSnapshot(snapshot)
  });

  const installMutation = useMutation({
    mutationFn: async (): Promise<ShellyInstallResult> => {
      if (!configState.ok) {
        throw new Error(configState.error);
      }
      if (!isThresholdValid) {
        throw new Error(t('hardware.flow.thresholdOrderInvalid'));
      }
      if (!isVpdAssistValid) {
        throw new Error(t('hardware.flow.vpdInvalid'));
      }
      if (!selectedShelly) {
        throw new Error(t('hardware.flow.noSelectedShelly'));
      }
      await cleanupStaleShellyBleDiscoveryScripts(selectedShelly.baseUrl);
      const client = new RpcShellyClient(createShellyTransport(selectedShelly.baseUrl));
      const result = await client.installScript(createInstallPlan(configState.script));
      return unwrapShellyResult(result);
    },
    onSuccess: (result) => {
      if (selectedShelly) {
        setShellyScriptIdDraft(selectedShelly.id, String(result.scriptId));
        setLastInstallState({
          shellyId: selectedShelly.id,
          scriptId: result.scriptId,
          scriptHash: result.scriptHash
        });
        setSafeRelayTestState(null);
      }
    }
  });

  const safeRelayTestMutation = useMutation({
    mutationFn: async (): Promise<SafeRelayTestMutationResult> => {
      if (!selectedShelly) {
        throw new Error(t('hardware.flow.noSelectedShelly'));
      }
      if (!isLastInstallCurrent || !lastInstallState) {
        throw new Error(t('hardware.flow.installFirst'));
      }
      const client = new RpcShellyClient(createShellyTransport(selectedShelly.baseUrl));
      const relayTest = unwrapShellyResult(await client.safeRelayTest());
      if (relayTest.finalRelayOn) {
        throw new Error(t('hardware.flow.relayOffNotConfirmed'));
      }
      return {
        install: lastInstallState,
        relayTest
      };
    },
    onSuccess: ({ install }) => {
      setSafeRelayTestState(install);
      diagnosticMutation.mutate(install.scriptId);
    }
  });

  const selectShellyDevice = (id: string) => {
    selectShellyDeviceDraft(id);
    setSetupStatus(null);
    setDiagnosticSnapshot(null);
    setLastInstallState(null);
    setSafeRelayTestState(null);
  };

  const selectSensorDevice = (id: string) => {
    selectSensorDeviceDraft(id);
    setDiagnosticSnapshot(null);
    setLastInstallState(null);
    setSafeRelayTestState(null);
  };

  const setDiagnosticShellyId = (id: string) => {
    setDiagnosticShellyIdDraft(id);
    setDiagnosticSnapshot(null);
  };

  const removeShellyDevice = (id: string) => {
    removeShellyDeviceDraft(id);
    setShellyControlStates((current) =>
      Object.fromEntries(Object.entries(current).filter(([deviceId]) => deviceId !== id))
    );
    setSetupStatus(null);
    setDiagnosticSnapshot(null);
    setLastInstallState(null);
    setSafeRelayTestState(null);
  };

  const removeSensorDevice = (id: string) => {
    removeSensorDeviceDraft(id);
    setDiagnosticSnapshot(null);
    setLastInstallState(null);
    setSafeRelayTestState(null);
  };

  return {
    shellyNameInput,
    setShellyNameInput,
    shellyUrlInput,
    setShellyUrlInput: updateShellyUrlInput,
    shellyInputState,
    shellyDevices,
    selectedShellyId,
    selectedShelly,
    selectShellyDevice,
    setShellyDeviceName,
    upsertShellyDevice,
    removeShellyDevice,
    sensorProfileInput,
    setSensorProfileInput,
    sensorMacInput,
    setSensorMacInput,
    sensorNameInput,
    setSensorNameInput,
    sensorDevices,
    selectedSensorId,
    selectedSensor,
    sensorInputState,
    addSensorDraft,
    selectSensorDevice,
    setSensorDeviceName,
    removeSensorDevice,
    diagnosticShellyId,
    setDiagnosticShellyId,
    diagnosticShelly,
    rulePreset,
    setRulePreset: (value: RulePresetId) => setRulePreset(value),
    onThresholdInput,
    setOnThresholdInput,
    offThresholdInput,
    setOffThresholdInput,
    vpdAssistEnabled,
    setVpdAssistEnabled,
    vpdTargetInput,
    setVpdTargetInput,
    rssiMinInput,
    setRssiMinInput,
    staleTimeoutMinInput,
    setStaleTimeoutMinInput,
    minChangeMinInput,
    setMinChangeMinInput,
    maxOnHoursInput,
    setMaxOnHoursInput,
    advancedSettingsValidation,
    isAdvancedSettingsValid: advancedSettingsValidation.isValid,
    shellyBaseUrl,
    configState,
    currentScriptHash,
    isThresholdValid,
    isVpdAssistValid,
    lastInstallState,
    isLastInstallCurrent,
    isSafeRelayTestComplete,
    canRunSafeRelayTest,
    setupStatus,
    diagnosticSnapshot,
    checkShellyMutation,
    recheckShellyMutation,
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan,
    shellyControlStates,
    refreshShellyControlMutation,
    turnRelayOnMutation,
    turnRelayOffMutation,
    setAutomationAutoMutation,
    setAutomationManualMutation,
    automationScriptState,
    fetchAutomationScriptMutation,
    deleteAutomationScriptMutation,
    refreshShellyControl,
    turnRelayOn,
    turnRelayOff,
    setAutomationAuto,
    setAutomationManual,
    acknowledgeShellyControlFeedback,
    fetchAutomationScript,
    deleteAutomationScript,
    bleDiscoverySession,
    bleDiscoverySnapshot,
    startBleDiscoveryMutation,
    refreshBleDiscoveryMutation,
    restartBleDiscoveryMutation,
    stopBleDiscoveryMutation,
    startBleDiscovery,
    refreshBleDiscovery,
    restartBleDiscovery,
    stopBleDiscovery,
    cleanupBleDiscovery,
    resetBleDiscovery,
    phoneBleScanCandidates,
    phoneBleScanMutation,
    startPhoneBleScan,
    stopPhoneBleScan,
    resetPhoneBleScan,
    addDiscoveredSensor,
    installMutation,
    safeRelayTestMutation,
    diagnosticMutation
  };
};

export type HardwareSetupFlow = ReturnType<typeof useHardwareSetupFlow>;
