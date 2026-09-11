#!/usr/bin/env sh
set -eu

BASE=fe24169685f6e2acf8b9acb15a6d2d4276f3b55b
BRANCH=work/production-readiness-hardening-20260911

git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test -z "$(git status --porcelain)"

cat > apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts <<'EOF'
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
EOF

cat > apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts <<'EOF'
import { useMutation } from '@tanstack/react-query';
import { generateShellyBleDiscoveryScript } from '@lcl/script-generator';
import { useState } from 'react';
import { t } from '../../app/i18n.js';
import type { BleDiscoverySnapshot } from './schemas.js';
import {
  installShellyBleDiscoveryScript,
  prepareShellyBleDiscovery,
  readShellyBleDiscoverySnapshot,
  restartShellyBleDiscoveryScan,
  stopShellyBleDiscovery
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';

export type BleDiscoverySession = {
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

export const useShellyBleDiscoveryFlow = () => {
  const [bleDiscoverySession, setBleDiscoverySession] =
    useState<BleDiscoverySession | null>(null);
  const [bleDiscoverySnapshot, setBleDiscoverySnapshot] =
    useState<BleDiscoverySnapshot | null>(null);

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

  return {
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
    resetBleDiscovery
  };
};
EOF

cat > apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts <<'EOF'
import { Capacitor } from '@capacitor/core';
import { useMutation } from '@tanstack/react-query';
import {
  CapacitorBleGattClient,
  CapacitorBleScanner,
  setPvvxDeviceTime,
  type BleScanner
} from '@lcl/ble-core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { t } from '../../app/i18n.js';
import {
  mergeBleDiscoveryCandidate,
  scanPhoneBleSensors,
  type PhoneBleScanOutcome
} from './phoneBleScan.js';
import type { BleDiscoveryCandidate } from './schemas.js';
import {
  sensorReadingFromCandidate,
  useHardwareSetupReadingsStore
} from './sensorReadingsStore.js';
import {
  useHardwareSetupDraftStore,
  type SensorDraftDevice
} from './setupDraftStore.js';
import { normalizeRuntimeAddress } from './validation.js';

type SavedSensorLiveScanState = {
  running: boolean;
  error: string | null;
  updatedAtMs: number | null;
};

type SensorRuntimeSource = 'phone-scan' | 'shelly-scan';

type PvvxTimeMutationResult = {
  device: SensorDraftDevice;
  acknowledged: boolean;
};

const PHONE_GATT_RADIO_SETTLE_MS = 1200;

const waitForPhoneBleRadioIdle = (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, PHONE_GATT_RADIO_SETTLE_MS);
  });

const savedSensorLiveScanError = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
      ? error.message
      : t('hardware.sensor.phoneBleGenericFailed');

export const usePhoneSensorFlow = (sensorDevices: readonly SensorDraftDevice[]) => {
  const appendSensorReading = useHardwareSetupReadingsStore(
    (state) => state.appendSensorReading
  );
  const upsertSensorDevice = useHardwareSetupDraftStore(
    (state) => state.upsertSensorDevice
  );
  const [phoneBleScanCandidates, setPhoneBleScanCandidates] = useState<
    BleDiscoveryCandidate[]
  >([]);
  const phoneBleScannerRef = useRef<BleScanner | null>(null);
  const savedSensorLiveScannerRef = useRef<BleScanner | null>(null);
  const [savedSensorLiveScanState, setSavedSensorLiveScanState] =
    useState<SavedSensorLiveScanState>({
      running: false,
      error: null,
      updatedAtMs: null
    });
  const savedSensorRuntimeAddresses = useMemo(
    () => new Set(sensorDevices.map((device) => device.runtimeAddress.toUpperCase())),
    [sensorDevices]
  );

  const stopSavedSensorLiveScanNow = useCallback(async (): Promise<void> => {
    const scanner = savedSensorLiveScannerRef.current;
    savedSensorLiveScannerRef.current = null;
    if (!scanner) {
      return;
    }
    setSavedSensorLiveScanState((current) => ({
      ...current,
      running: false
    }));
    await scanner.stopScan().catch(() => undefined);
  }, []);

  const stopSavedSensorLiveScan = useCallback(() => {
    void stopSavedSensorLiveScanNow();
  }, [stopSavedSensorLiveScanNow]);

  const startSavedSensorLiveScan = useCallback(() => {
    if (
      Capacitor.getPlatform() === 'web' ||
      savedSensorLiveScannerRef.current ||
      phoneBleScannerRef.current ||
      savedSensorRuntimeAddresses.size === 0
    ) {
      return;
    }

    const scanner = new CapacitorBleScanner({ platform: Capacitor.getPlatform() });
    savedSensorLiveScannerRef.current = scanner;
    setSavedSensorLiveScanState((current) => ({
      ...current,
      running: true,
      error: null
    }));

    void scanPhoneBleSensors({
      scanner,
      timeoutMs: 0,
      onCandidate: (candidate) => {
        const runtimeAddress = normalizeRuntimeAddress(candidate.runtimeAddress);
        if (!savedSensorRuntimeAddresses.has(runtimeAddress.toUpperCase())) {
          return;
        }

        appendSensorReading(
          sensorReadingFromCandidate({ ...candidate, runtimeAddress }, 'phone-scan')
        );
        setSavedSensorLiveScanState({
          running: true,
          error: null,
          updatedAtMs: Date.now()
        });
      }
    })
      .catch((error: unknown) => {
        if (savedSensorLiveScannerRef.current !== scanner) {
          return;
        }
        setSavedSensorLiveScanState((current) => ({
          ...current,
          running: false,
          error: savedSensorLiveScanError(error)
        }));
      })
      .finally(() => {
        if (savedSensorLiveScannerRef.current === scanner) {
          savedSensorLiveScannerRef.current = null;
          setSavedSensorLiveScanState((current) => ({
            ...current,
            running: false
          }));
        }
      });
  }, [appendSensorReading, savedSensorRuntimeAddresses]);

  const restartSavedSensorLiveScan = useCallback(async (): Promise<void> => {
    await stopSavedSensorLiveScanNow();
    startSavedSensorLiveScan();
  }, [startSavedSensorLiveScan, stopSavedSensorLiveScanNow]);

  const preparePhoneGattConnection = useCallback(async (): Promise<void> => {
    const hadSavedSensorScan = savedSensorLiveScannerRef.current !== null;
    const phoneScanner = phoneBleScannerRef.current;
    phoneBleScannerRef.current = null;

    await stopSavedSensorLiveScanNow();
    await phoneScanner?.stopScan().catch(() => undefined);

    if (hadSavedSensorScan || phoneScanner) {
      await waitForPhoneBleRadioIdle();
    }
  }, [stopSavedSensorLiveScanNow]);

  const upsertPhoneBleScanCandidate = (candidate: BleDiscoveryCandidate) => {
    appendSensorReading(sensorReadingFromCandidate(candidate, 'phone-scan'));
    setPhoneBleScanCandidates((current) =>
      mergeBleDiscoveryCandidate(current, candidate)
    );
  };

  const phoneBleScanMutation = useMutation({
    mutationFn: async (): Promise<PhoneBleScanOutcome> => {
      await stopSavedSensorLiveScanNow();
      const scanner = new CapacitorBleScanner({ platform: Capacitor.getPlatform() });
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

  const addDiscoveredSensor = (
    candidate: BleDiscoveryCandidate,
    source: SensorRuntimeSource = 'phone-scan'
  ) => {
    const runtimeAddress = normalizeRuntimeAddress(candidate.runtimeAddress);
    const name = t('hardware.flow.sensorDefaultName', {
      suffix: runtimeAddress.split(':').slice(-2).join(':')
    });
    appendSensorReading(
      sensorReadingFromCandidate({ ...candidate, runtimeAddress }, source)
    );
    upsertSensorDevice({
      id: runtimeAddress,
      name,
      runtimeAddress,
      profileId: candidate.profileId
    });
  };

  const setPvvxTimeMutation = useMutation({
    mutationFn: async (device: SensorDraftDevice): Promise<PvvxTimeMutationResult> => {
      if (device.profileId !== 'xiaomi_lywsd03mmc_bthome_v2') {
        throw new Error(t('hardware.sensor.pvvxOnlyXiaomi'));
      }
      if (Capacitor.getPlatform() === 'web') {
        throw new Error(t('hardware.sensor.pvvxMobileOnly'));
      }

      await preparePhoneGattConnection();
      const gatt = new CapacitorBleGattClient();
      const status = await setPvvxDeviceTime({
        gatt,
        deviceId: device.runtimeAddress
      });
      return { device, acknowledged: status !== null };
    }
  });

  return {
    phoneBleScanCandidates,
    phoneBleScanMutation,
    startPhoneBleScan,
    stopPhoneBleScan,
    resetPhoneBleScan,
    savedSensorLiveScanState,
    startSavedSensorLiveScan,
    restartSavedSensorLiveScan,
    stopSavedSensorLiveScan,
    addDiscoveredSensor,
    setPvvxTimeMutation
  };
};
EOF

python3 - <<'PY'
from pathlib import Path
import re
p=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s=p.read_text()

# Imports now owned by extracted hooks.
s=s.replace("import { Capacitor } from '@capacitor/core';\n", '')
s=re.sub(r"import \{\n  CapacitorBleGattClient,\n  CapacitorBleScanner,\n  setPvvxDeviceTime,\n  type BleScanner\n\} from '@lcl/ble-core';\n", '', s)
s=s.replace('  generateShellyBleDiscoveryScript,\n', '')
s=s.replace("import { useCallback, useMemo, useRef, useState } from 'react';", "import { useMemo, useRef, useState } from 'react';")
for line in [
  '  installShellyBleDiscoveryScript,\n',
  '  prepareShellyBleDiscovery,\n',
  '  readShellyBleDiscoverySnapshot,\n',
  '  readShellyControlStatus,\n',
  '  restartShellyBleDiscoveryScan,\n',
  '  stopShellyBleDiscovery,\n',
  '  type ShellyControlStatus,\n'
]:
    s=s.replace(line,'')
s=re.sub(r"import \{\n  mergeBleDiscoveryCandidate,\n  scanPhoneBleSensors,\n  type PhoneBleScanOutcome\n\} from './phoneBleScan.js';\n", '', s)
s=s.replace("import {\n  sensorReadingFromCandidate,\n  useHardwareSetupReadingsStore\n} from './sensorReadingsStore.js';", "import { useHardwareSetupReadingsStore } from './sensorReadingsStore.js';")
insert="""import { usePhoneSensorFlow } from './usePhoneSensorFlow.js';
import { useShellyBleDiscoveryFlow } from './useShellyBleDiscoveryFlow.js';
import {
  shellyControlStatusFromSetupStatus,
  useShellyControlFlow
} from './useShellyControlFlow.js';
"""
marker="""import {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  parseRuleAdvancedSettings,
  validateRuleAdvancedSettings
} from './ruleAdvancedSettings.js';
"""
if s.count(marker)!=1: raise SystemExit('ruleAdvanced import marker mismatch')
s=s.replace(marker, marker+insert,1)

# Types/constants moved into subsystem hooks.
patterns=[
 r"type BleDiscoverySession = \{[\s\S]*?\n\};\n\ntype StartBleDiscoveryResult = \{[\s\S]*?\n\};\n\n",
 r"type ShellyControlAction = [^\n]+\n\ntype ShellyControlViewState = \{[\s\S]*?\n\};\n\n",
 r"type SavedSensorLiveScanState = \{[\s\S]*?\n\};\n\nconst savedSensorLiveScanError = [\s\S]*?t\('hardware\.sensor\.phoneBleGenericFailed'\);\n\n",
 r"type ShellyControlMutationResult = \{[\s\S]*?\n\};\n\n",
 r"type SensorRuntimeSource = [^\n]+\n\ntype PvvxTimeMutationResult = \{[\s\S]*?\n\};\n\n",
 r"const PHONE_GATT_RADIO_SETTLE_MS = 1200;\n\nconst waitForPhoneBleRadioIdle = [\s\S]*?\n\n",
 r"const createInitialShellyControlState = \(\): ShellyControlViewState => \(\{[\s\S]*?\n\}\);\n\n"
]
for rx in patterns:
    s,n=re.subn(rx,'',s,count=1)
    if n!=1: raise SystemExit(f'type/constant extraction marker failed: {rx[:50]} -> {n}')

# Parent no longer owns phone reading append state.
s,n=re.subn(r"  const appendSensorReading = useHardwareSetupReadingsStore\(\n    \(state\) => state\.appendSensorReading\n  \);\n",'',s,count=1)
if n!=1: raise SystemExit('appendSensorReading marker mismatch')

# Parent no longer owns extracted subsystem state/refs.
for rx in [
 r"  const \[bleDiscoverySession, setBleDiscoverySession\] =\n    useState<BleDiscoverySession \| null>\(null\);\n  const \[bleDiscoverySnapshot, setBleDiscoverySnapshot\] =\n    useState<BleDiscoverySnapshot \| null>\(null\);\n",
 r"  const \[phoneBleScanCandidates, setPhoneBleScanCandidates\] = useState<\n    BleDiscoveryCandidate\[\]\n  >\(\[\]\);\n  const phoneBleScannerRef = useRef<BleScanner \| null>\(null\);\n  const savedSensorLiveScannerRef = useRef<BleScanner \| null>\(null\);\n  const \[savedSensorLiveScanState, setSavedSensorLiveScanState\] =\n    useState<SavedSensorLiveScanState>\(\{[\s\S]*?\n    \}\);\n",
 r"  const \[shellyControlStates, setShellyControlStates\] = useState<\n    Record<string, ShellyControlViewState>\n  >\(\{\}\);\n"
]:
    s,n=re.subn(rx,'',s,count=1)
    if n!=1: raise SystemExit(f'state extraction marker failed -> {n}: {rx[:60]}')

# Derived phone scan set is now private to usePhoneSensorFlow.
s,n=re.subn(r"  const savedSensorRuntimeAddresses = useMemo\(\n    \(\) => new Set\(sensorDevices\.map\(\(device\) => device\.runtimeAddress\.toUpperCase\(\)\)\),\n    \[sensorDevices\]\n  \);\n",'',s,count=1)
if n!=1: raise SystemExit('savedSensorRuntimeAddresses marker mismatch')

# Install hook facades before parent helpers. Public return surface stays compatible.
marker="""  const [safeRelayTestState, setSafeRelayTestState] =
    useState<HardwareInstallState | null>(null);

"""
hooks="""  const {
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
  } = useShellyControlFlow();
  const {
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
    resetBleDiscovery
  } = useShellyBleDiscoveryFlow();
  const {
    phoneBleScanCandidates,
    phoneBleScanMutation,
    startPhoneBleScan,
    stopPhoneBleScan,
    resetPhoneBleScan,
    savedSensorLiveScanState,
    startSavedSensorLiveScan,
    restartSavedSensorLiveScan,
    stopSavedSensorLiveScan,
    addDiscoveredSensor,
    setPvvxTimeMutation
  } = usePhoneSensorFlow(sensorDevices);

"""
if s.count(marker)!=1: raise SystemExit('hook insertion marker mismatch')
s=s.replace(marker,marker+hooks,1)

# Calls into control state now use the extracted facade/pure adapter.
s=s.replace('controlStatusFromSetupStatus(status)', 'shellyControlStatusFromSetupStatus(status)')

# Remove old Shelly control implementation but preserve script load/delete logic.
start=s.find('  const setShellyControlState = (')
end=s.find('  const loadAutomationScriptMutation = useMutation({', start)
if start==-1 or end==-1 or end<=start: raise SystemExit('control implementation boundaries not found')
s=s[:start]+s[end:]

# Remove old BLE discovery implementation.
start=s.find('  const startBleDiscoveryMutation = useMutation({')
end=s.find('  const stopSavedSensorLiveScanNow = useCallback', start)
if start==-1 or end==-1 or end<=start: raise SystemExit('BLE discovery boundaries not found')
s=s[:start]+s[end:]

# Remove old phone BLE/live-sensor implementation.
start=s.find('  const stopSavedSensorLiveScanNow = useCallback')
end=s.find('  const fetchDiagnostics = async (', start)
if start==-1 or end==-1 or end<=start: raise SystemExit('phone sensor boundaries not found')
s=s[:start]+s[end:]

# Device removal delegates subsystem-owned state cleanup.
old="""    setShellyControlStates((current) =>
      Object.fromEntries(Object.entries(current).filter(([deviceId]) => deviceId !== id))
    );
"""
if s.count(old)!=1: raise SystemExit('removeShelly control cleanup marker mismatch')
s=s.replace(old,'    removeShellyControlState(id);\n',1)

p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts \
  apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts

git diff --check
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm --filter @lcl/mobile test -- --run src/__tests__/hardware-setup.test.tsx
pnpm check:full

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
lines=len(p.read_text().splitlines())
print(f'HARDWARE_SETUP_FLOW_LINES={lines}')
if lines >= 1200:
    raise SystemExit(f'hardware setup orchestrator still too large after decomposition: {lines}')
for name in ['useShellyControlFlow.ts','useShellyBleDiscoveryFlow.ts','usePhoneSensorFlow.ts']:
    q=Path('apps/mobile/src/flows/hardware-setup')/name
    count=len(q.read_text().splitlines())
    print(f'{name}={count}')
    if count >= 350:
        raise SystemExit(f'extracted subsystem too large: {name}={count}')
print('HARDWARE_FLOW_DECOMPOSITION_OK=1')
PY

git add apps/mobile/src/flows/hardware-setup
git diff --cached --check
git commit -m "refactor(mobile): decompose hardware setup flow"
git push origin "$BRANCH"
echo "HARDWARE_FLOW_DECOMPOSITION_SHA=$(git rev-parse HEAD)"
