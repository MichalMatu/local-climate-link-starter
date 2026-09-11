#!/usr/bin/env sh
set -eu

: "${EXPECTED_BASE:?EXPECTED_BASE is required}"
BRANCH=work/production-readiness-hardening-20260911

git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$EXPECTED_BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$EXPECTED_BASE"
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

type ShellyControlAction = 'status' | 'on' | 'off' | 'auto' | 'manual';

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

const requireAutomationScript = (status: ShellyControlStatus): number => {
  if (status.automationScriptId === null) {
    throw new Error(t('hardware.rule.automationScriptMissing'));
  }
  return status.automationScriptId;
};

export const useShellyControlFlow = () => {
  const [states, setStates] = useState<Record<string, ShellyControlViewState>>({});

  const patchState = useCallback(
    (deviceId: string, patch: Partial<ShellyControlViewState>) => {
      setStates((current) => ({
        ...current,
        [deviceId]: {
          ...(current[deviceId] ?? createInitialShellyControlState()),
          ...patch
        }
      }));
    },
    []
  );

  const applyStatus = useCallback(
    (device: ShellyDraftDevice, status: ShellyControlStatus, message: string | null) => {
      patchState(device.id, {
        status,
        pendingAction: null,
        error: null,
        message,
        updatedAtMs: Date.now()
      });
    },
    [patchState]
  );

  const applyError = useCallback(
    (
      device: ShellyDraftDevice,
      error: unknown,
      fallbackMessage = t('common.operationFailed')
    ) => {
      patchState(device.id, {
        pendingAction: null,
        error: error instanceof Error ? error.message : fallbackMessage,
        message: null,
        updatedAtMs: Date.now()
      });
    },
    [patchState]
  );

  const syncFromSetupStatus = useCallback(
    (device: ShellyDraftDevice, status: HardwareSetupStatus) => {
      applyStatus(device, controlStatusFromSetupStatus(status), null);
    },
    [applyStatus]
  );

  const removeState = useCallback((deviceId: string) => {
    setStates((current) => {
      if (!(deviceId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[deviceId];
      return next;
    });
  }, []);

  const refreshMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<ShellyControlMutationResult> => ({
      device,
      status: await readShellyControlStatus(device.baseUrl)
    }),
    onMutate: (device) =>
      patchState(device.id, { pendingAction: 'status', error: null, message: null }),
    onSuccess: ({ device, status }) => applyStatus(device, status, null),
    onError: (error, device) => applyError(device, error)
  });

  const relayOnMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<ShellyControlMutationResult> => {
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(await client.setRelayOn());
      return { device, status: await readShellyControlStatus(device.baseUrl) };
    },
    onMutate: (device) =>
      patchState(device.id, { pendingAction: 'on', error: null, message: null }),
    onSuccess: ({ device, status }) =>
      applyStatus(device, status, t('hardware.flow.relayOn')),
    onError: (error, device) => applyError(device, error)
  });

  const relayOffMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<ShellyControlMutationResult> => {
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(await client.setRelayOff());
      return { device, status: await readShellyControlStatus(device.baseUrl) };
    },
    onMutate: (device) =>
      patchState(device.id, { pendingAction: 'off', error: null, message: null }),
    onSuccess: ({ device, status }) =>
      applyStatus(device, status, t('hardware.flow.relayOff')),
    onError: (error, device) => applyError(device, error)
  });

  const autoMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<ShellyControlMutationResult> => {
      const currentStatus = await readShellyControlStatus(device.baseUrl);
      const scriptId = requireAutomationScript(currentStatus);
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(await client.startScript(scriptId));
      return { device, status: await readShellyControlStatus(device.baseUrl) };
    },
    onMutate: (device) =>
      patchState(device.id, { pendingAction: 'auto', error: null, message: null }),
    onSuccess: ({ device, status }) =>
      applyStatus(device, status, t('hardware.flow.relayAutoStarted')),
    onError: (error, device) => applyError(device, error)
  });

  const manualMutation = useMutation({
    mutationFn: async (device: ShellyDraftDevice): Promise<ShellyControlMutationResult> => {
      const currentStatus = await readShellyControlStatus(device.baseUrl);
      const scriptId = requireAutomationScript(currentStatus);
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      const stopResult = await client.stopScript(scriptId);
      const offResult = await client.setRelayOff();
      unwrapShellyResult(offResult);
      unwrapShellyResult(stopResult);
      return { device, status: await readShellyControlStatus(device.baseUrl) };
    },
    onMutate: (device) =>
      patchState(device.id, { pendingAction: 'manual', error: null, message: null }),
    onSuccess: ({ device, status }) =>
      applyStatus(device, status, t('hardware.flow.relayManualOff')),
    onError: (error, device) => applyError(device, error)
  });

  const acknowledgeFeedback = useCallback(
    (deviceId: string, updatedAtMs: number, message: string) => {
      setStates((current) => {
        const state = current[deviceId];
        if (!state || state.updatedAtMs !== updatedAtMs) {
          return current;
        }
        if ((state.error ?? state.message) !== message) {
          return current;
        }
        return {
          ...current,
          [deviceId]: { ...state, error: null, message: null }
        };
      });
    },
    []
  );

  return {
    states,
    syncFromSetupStatus,
    applyStatus,
    applyError,
    removeState,
    refreshMutation,
    relayOnMutation,
    relayOffMutation,
    autoMutation,
    manualMutation,
    refresh: (device: ShellyDraftDevice) => refreshMutation.mutate(device),
    turnOn: (device: ShellyDraftDevice) => relayOnMutation.mutate(device),
    turnOff: (device: ShellyDraftDevice) => relayOffMutation.mutate(device),
    setAuto: (device: ShellyDraftDevice) => autoMutation.mutate(device),
    setManual: (device: ShellyDraftDevice) => manualMutation.mutate(device),
    acknowledgeFeedback
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
  const [session, setSession] = useState<BleDiscoverySession | null>(null);
  const [snapshot, setSnapshot] = useState<BleDiscoverySnapshot | null>(null);

  const startMutation = useMutation({
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
        const nextSession: BleDiscoverySession = {
          shellyId: device.id,
          baseUrl: device.baseUrl,
          discoveryScriptId: installResult.scriptId,
          automationScriptId: preparation.automationScriptId,
          automationWasRunning: preparation.automationWasRunning
        };
        const nextSnapshot = await readShellyBleDiscoverySnapshot(
          device.baseUrl,
          installResult.scriptId
        );
        return { session: nextSession, snapshot: nextSnapshot };
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
    onSuccess: ({ session: nextSession, snapshot: nextSnapshot }) => {
      setSession(nextSession);
      setSnapshot(nextSnapshot);
    },
    onError: () => {
      setSession(null);
      setSnapshot(null);
    }
  });

  const refreshMutation = useMutation({
    mutationFn: async (active: BleDiscoverySession): Promise<BleDiscoverySnapshot> =>
      readShellyBleDiscoverySnapshot(active.baseUrl, active.discoveryScriptId),
    onSuccess: (nextSnapshot) => setSnapshot(nextSnapshot)
  });

  const restartMutation = useMutation({
    mutationFn: async (active: BleDiscoverySession): Promise<BleDiscoverySnapshot> => {
      await restartShellyBleDiscoveryScan(active.baseUrl, active.discoveryScriptId);
      return readShellyBleDiscoverySnapshot(active.baseUrl, active.discoveryScriptId);
    },
    onSuccess: (nextSnapshot) => setSnapshot(nextSnapshot)
  });

  const stopMutation = useMutation({
    mutationFn: async (active: BleDiscoverySession): Promise<void> =>
      stopShellyBleDiscovery(active.baseUrl, {
        discoveryScriptId: active.discoveryScriptId,
        automationScriptId: active.automationScriptId,
        restartAutomation: active.automationWasRunning
      }),
    onSuccess: () => setSession(null)
  });

  const start = (device: ShellyDraftDevice) => {
    setSnapshot(null);
    setSession(null);
    refreshMutation.reset();
    stopMutation.reset();
    startMutation.mutate(device);
  };

  const refresh = () => {
    if (session) {
      refreshMutation.mutate(session);
    }
  };

  const restart = () => {
    if (!session || restartMutation.isPending) {
      return;
    }
    refreshMutation.reset();
    restartMutation.reset();
    restartMutation.mutate(session);
  };

  const stop = () => {
    if (!session || stopMutation.isPending) {
      return;
    }
    stopMutation.mutate(session);
  };

  const cleanup = () => {
    if (!session || stopMutation.isPending) {
      return;
    }
    stopMutation.mutate(session);
  };

  const reset = () => {
    setSnapshot(null);
    startMutation.reset();
    refreshMutation.reset();
    restartMutation.reset();
    stopMutation.reset();
  };

  return {
    session,
    snapshot,
    startMutation,
    refreshMutation,
    restartMutation,
    stopMutation,
    start,
    refresh,
    restart,
    stop,
    cleanup,
    reset
  };
};
EOF

python3 - <<'PY'
from pathlib import Path
import re
p=Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s=p.read_text()

# imports now owned by focused subflows
s=s.replace('  generateShellyBleDiscoveryScript,\n','')
for line in [
  '  installShellyBleDiscoveryScript,\n',
  '  prepareShellyBleDiscovery,\n',
  '  readShellyBleDiscoverySnapshot,\n',
  '  restartShellyBleDiscoveryScan,\n',
  '  stopShellyBleDiscovery,\n'
]:
    s=s.replace(line,'')
s=s.replace('  type BleDiscoverySnapshot,\n','')
insert="""import { useShellyBleDiscoveryFlow } from './useShellyBleDiscoveryFlow.js';
import { useShellyControlFlow } from './useShellyControlFlow.js';
"""
marker="import {\n  DEFAULT_RULE_ADVANCED_SETTINGS,"
if s.count(marker)!=1: raise SystemExit('import insertion marker missing')
s=s.replace(marker,insert+marker,1)

# obsolete local control/discovery types
for block in [
"""type BleDiscoverySession = {
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

""",
"""type ShellyControlAction = 'status' | 'on' | 'off' | 'auto' | 'manual';

type ShellyControlViewState = {
  status: ShellyControlStatus | null;
  pendingAction: ShellyControlAction | null;
  error: string | null;
  message: string | null;
  updatedAtMs: number | null;
};

""",
"""type ShellyControlMutationResult = {
  device: ShellyDraftDevice;
  status: ShellyControlStatus;
};

""",
"""const createInitialShellyControlState = (): ShellyControlViewState => ({
  status: null,
  pendingAction: null,
  error: null,
  message: null,
  updatedAtMs: null
});

"""
]:
    if s.count(block)!=1: raise SystemExit('obsolete block marker mismatch')
    s=s.replace(block,'',1)

# states moved into focused hooks
for block in [
"""  const [bleDiscoverySession, setBleDiscoverySession] =
    useState<BleDiscoverySession | null>(null);
  const [bleDiscoverySnapshot, setBleDiscoverySnapshot] =
    useState<BleDiscoverySnapshot | null>(null);
""",
"""  const [shellyControlStates, setShellyControlStates] = useState<
    Record<string, ShellyControlViewState>
  >({});
"""
]:
    if s.count(block)!=1: raise SystemExit('moved state marker mismatch')
    s=s.replace(block,'',1)

marker="""  const [safeRelayTestState, setSafeRelayTestState] =
    useState<HardwareInstallState | null>(null);
"""
if s.count(marker)!=1: raise SystemExit('subflow init marker missing')
s=s.replace(marker, marker+"  const shellyControlFlow = useShellyControlFlow();\n  const shellyBleDiscoveryFlow = useShellyBleDiscoveryFlow();\n",1)

# local control helper implementation moves out
start=s.find('  const setShellyControlState = (')
end=s.find('  const checkShellyMutation = useMutation({',start)
if start<0 or end<0: raise SystemExit('control helper range missing')
s=s[:start]+s[end:]

old="""      applyControlStatus(
        status.checkedDevice,
        controlStatusFromSetupStatus(status),
        null
      );"""
new="""      shellyControlFlow.syncFromSetupStatus(status.checkedDevice, status);"""
if s.count(old)!=1: raise SystemExit(f'check sync marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
old="""      applyControlStatus(device, controlStatusFromSetupStatus(status), null);"""
new="""      shellyControlFlow.syncFromSetupStatus(device, status);"""
if s.count(old)!=1: raise SystemExit(f'recheck sync marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)

# local control mutations/actions move out
start=s.find('  const refreshShellyControlMutation = useMutation({')
end=s.find('  const loadAutomationScriptMutation = useMutation({',start)
if start<0 or end<0: raise SystemExit('control mutation range missing')
s=s[:start]+s[end:]
# remaining script load/delete callbacks use control subflow internals
s=s.replace('applyControlStatus(', 'shellyControlFlow.applyStatus(')
s=s.replace('applyControlError(', 'shellyControlFlow.applyError(')

# Shelly BLE discovery state/mutations/actions move out
start=s.find('  const startBleDiscoveryMutation = useMutation({')
end=s.find('  const stopSavedSensorLiveScanNow = useCallback(',start)
if start<0 or end<0: raise SystemExit('BLE discovery range missing')
s=s[:start]+s[end:]

old="""    setShellyControlStates((current) =>
      Object.fromEntries(Object.entries(current).filter(([deviceId]) => deviceId !== id))
    );"""
new="""    shellyControlFlow.removeState(id);"""
if s.count(old)!=1: raise SystemExit(f'remove control state marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)

# Keep current page-facing API stable while implementation is decomposed.
replacements={
 '    shellyControlStates,':'    shellyControlStates: shellyControlFlow.states,',
 '    refreshShellyControlMutation,':'    refreshShellyControlMutation: shellyControlFlow.refreshMutation,',
 '    turnRelayOnMutation,':'    turnRelayOnMutation: shellyControlFlow.relayOnMutation,',
 '    turnRelayOffMutation,':'    turnRelayOffMutation: shellyControlFlow.relayOffMutation,',
 '    setAutomationAutoMutation,':'    setAutomationAutoMutation: shellyControlFlow.autoMutation,',
 '    setAutomationManualMutation,':'    setAutomationManualMutation: shellyControlFlow.manualMutation,',
 '    refreshShellyControl,':'    refreshShellyControl: shellyControlFlow.refresh,',
 '    turnRelayOn,':'    turnRelayOn: shellyControlFlow.turnOn,',
 '    turnRelayOff,':'    turnRelayOff: shellyControlFlow.turnOff,',
 '    setAutomationAuto,':'    setAutomationAuto: shellyControlFlow.setAuto,',
 '    setAutomationManual,':'    setAutomationManual: shellyControlFlow.setManual,',
 '    acknowledgeShellyControlFeedback,':'    acknowledgeShellyControlFeedback: shellyControlFlow.acknowledgeFeedback,',
 '    bleDiscoverySession,':'    bleDiscoverySession: shellyBleDiscoveryFlow.session,',
 '    bleDiscoverySnapshot,':'    bleDiscoverySnapshot: shellyBleDiscoveryFlow.snapshot,',
 '    startBleDiscoveryMutation,':'    startBleDiscoveryMutation: shellyBleDiscoveryFlow.startMutation,',
 '    refreshBleDiscoveryMutation,':'    refreshBleDiscoveryMutation: shellyBleDiscoveryFlow.refreshMutation,',
 '    restartBleDiscoveryMutation,':'    restartBleDiscoveryMutation: shellyBleDiscoveryFlow.restartMutation,',
 '    stopBleDiscoveryMutation,':'    stopBleDiscoveryMutation: shellyBleDiscoveryFlow.stopMutation,',
 '    startBleDiscovery,':'    startBleDiscovery: shellyBleDiscoveryFlow.start,',
 '    refreshBleDiscovery,':'    refreshBleDiscovery: shellyBleDiscoveryFlow.refresh,',
 '    restartBleDiscovery,':'    restartBleDiscovery: shellyBleDiscoveryFlow.restart,',
 '    stopBleDiscovery,':'    stopBleDiscovery: shellyBleDiscoveryFlow.stop,',
 '    cleanupBleDiscovery,':'    cleanupBleDiscovery: shellyBleDiscoveryFlow.cleanup,',
 '    resetBleDiscovery,':'    resetBleDiscovery: shellyBleDiscoveryFlow.reset,'
}
for old,new in replacements.items():
    if s.count(old)!=1: raise SystemExit(f'return marker mismatch {old!r}: {s.count(old)}')
    s=s.replace(old,new,1)

p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts

FLOW_LINES=$(wc -l < apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | tr -d ' ')
FLOW_MUTATIONS=$(grep -c 'useMutation({' apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts || true)
echo "HARDWARE_SETUP_FLOW_LINES=$FLOW_LINES"
echo "HARDWARE_SETUP_FLOW_MUTATIONS=$FLOW_MUTATIONS"
test "$FLOW_LINES" -lt 1400
test "$FLOW_MUTATIONS" -le 12

git diff --check
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx automation-detail.test.tsx app-routes.test.tsx
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile lint
pnpm quality:repo
pnpm check:full

git add apps/mobile/src/flows/hardware-setup
git diff --cached --check
git commit -m "refactor(mobile): split hardware setup subflows"
git push origin "$BRANCH"

echo "HARDWARE_FLOW_DECOMPOSITION_SHA=$(git rev-parse HEAD)"
echo 'HARDWARE_FLOW_DECOMPOSITION_OK=1'
