#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='1de39e8780b6d511bb8cff4251ccd6d8d8f33bd0'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts <<'EOF'
import { useMutation } from '@tanstack/react-query';
import {
  createInstallPlan,
  hashScriptCode,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RpcShellyClient,
  RpcShellyScheduleClient,
  type RelayTestResult,
  type ShellyInstallResult
} from '@lcl/shelly-client';
import { useMemo, useState } from 'react';
import { t } from '../../app/i18n.js';
import {
  createInstalledAutomation,
  findRelayOwnerConflict,
  type InstalledAutomation
} from '../installations/model.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { findScheduleRelayConflict } from '../time-automation/runtime.js';
import type { ClimateConfigState } from './ruleConfigDerivation.js';
import {
  cleanupStaleShellyBleDiscoveryScripts,
  createShellyTransport,
  unwrapShellyResult
} from './shellyRequests.js';
import { useHardwareSetupDraftStore, type ShellyDraftDevice } from './setupDraftStore.js';

type HardwareInstallState = {
  shellyId: string;
  scriptId: number;
  scriptHash: string;
};

type HardwareInstallMutationResult = {
  install: ShellyInstallResult;
  installation: InstalledAutomation;
  shellyDraftId: string;
};

type SafeRelayTestMutationResult = {
  install: HardwareInstallState;
  relayTest: RelayTestResult;
};

export const isHardwareInstallStateCurrent = (
  state: HardwareInstallState | null,
  shellyId: string | null,
  scriptHash: string | null
): boolean =>
  state !== null &&
  shellyId !== null &&
  scriptHash !== null &&
  state.shellyId === shellyId &&
  state.scriptHash === scriptHash;

export const useClimateAutomationInstallFlow = ({
  selectedShelly,
  configState,
  isThresholdValid,
  isVpdAssistValid,
  refreshDiagnostics
}: {
  selectedShelly: ShellyDraftDevice | null;
  configState: ClimateConfigState;
  isThresholdValid: boolean;
  isVpdAssistValid: boolean;
  refreshDiagnostics: (scriptId?: number) => void;
}) => {
  const installedAutomations = useInstalledAutomationStore((state) => state.installations);
  const upsertInstalledAutomation = useInstalledAutomationStore(
    (state) => state.upsertInstallation
  );
  const setShellyScriptIdDraft = useHardwareSetupDraftStore(
    (state) => state.setShellyScriptId
  );
  const [lastInstallState, setLastInstallState] = useState<HardwareInstallState | null>(
    null
  );
  const [safeRelayTestState, setSafeRelayTestState] =
    useState<HardwareInstallState | null>(null);

  const currentScriptHash = useMemo(
    () =>
      configState.ok
        ? hashScriptCode(`${LOCAL_CLIMATE_LINK_SCRIPT_NAME}:${configState.script}`)
        : null,
    [configState]
  );
  const selectedShellyId = selectedShelly?.id ?? null;
  const isLastInstallCurrent = isHardwareInstallStateCurrent(
    lastInstallState,
    selectedShellyId,
    currentScriptHash
  );
  const isSafeRelayTestComplete = isHardwareInstallStateCurrent(
    safeRelayTestState,
    selectedShellyId,
    currentScriptHash
  );
  const canRunSafeRelayTest = isLastInstallCurrent && !isSafeRelayTestComplete;

  const installMutation = useMutation({
    mutationFn: async (): Promise<HardwareInstallMutationResult> => {
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

      const shelly = selectedShelly;
      const config = configState.config;
      await cleanupStaleShellyBleDiscoveryScripts(shelly.baseUrl);
      const transport = createShellyTransport(shelly.baseUrl);
      const client = new RpcShellyClient(transport);
      const scheduleClient = new RpcShellyScheduleClient(transport);
      const deviceInfo = unwrapShellyResult(await client.getDeviceInfo());
      const deviceId = deviceInfo.id?.trim();
      if (!deviceId) {
        throw new Error(t('hardware.flow.shellyIdentityMissing'));
      }
      if (
        findRelayOwnerConflict({
          installations: installedAutomations,
          deviceId,
          relayId: config.output.relayId,
          requestedKind: 'climate'
        })
      ) {
        throw new Error(t('hardware.flow.relayOwnedByTimeAutomation'));
      }
      const schedules = unwrapShellyResult(await scheduleClient.list());
      if (findScheduleRelayConflict(schedules.jobs, config.output.relayId)) {
        throw new Error(t('hardware.flow.relayOwnedByNativeSchedule'));
      }
      const install = unwrapShellyResult(
        await client.installScript(createInstallPlan(configState.script))
      );
      return {
        install,
        installation: createInstalledAutomation({
          shelly: deviceInfo,
          shellyName: shelly.name,
          baseUrl: shelly.baseUrl,
          scriptId: install.scriptId,
          scriptHash: install.scriptHash,
          config
        }),
        shellyDraftId: shelly.id
      };
    },
    onSuccess: ({ install, installation, shellyDraftId }) => {
      setShellyScriptIdDraft(shellyDraftId, String(install.scriptId));
      upsertInstalledAutomation(installation);
      setLastInstallState({
        shellyId: shellyDraftId,
        scriptId: install.scriptId,
        scriptHash: install.scriptHash
      });
      setSafeRelayTestState(null);
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
      refreshDiagnostics(install.scriptId);
    }
  });

  const resetInstallState = () => {
    setLastInstallState(null);
    setSafeRelayTestState(null);
  };

  return {
    canRunSafeRelayTest,
    installMutation,
    safeRelayTestMutation,
    resetInstallState
  };
};
EOF

cat > apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { isHardwareInstallStateCurrent } from './useClimateAutomationInstallFlow.js';

const installed = {
  shellyId: 'http://192.168.0.20/',
  scriptId: 1,
  scriptHash: 'hash-a'
};

describe('climate automation install state', () => {
  it('is current only for the same Shelly and script hash', () => {
    expect(
      isHardwareInstallStateCurrent(installed, 'http://192.168.0.20/', 'hash-a')
    ).toBe(true);
    expect(
      isHardwareInstallStateCurrent(installed, 'http://192.168.0.21/', 'hash-a')
    ).toBe(false);
    expect(
      isHardwareInstallStateCurrent(installed, 'http://192.168.0.20/', 'hash-b')
    ).toBe(false);
  });

  it('is not current without complete state', () => {
    expect(isHardwareInstallStateCurrent(null, installed.shellyId, installed.scriptHash)).toBe(
      false
    );
    expect(isHardwareInstallStateCurrent(installed, null, installed.scriptHash)).toBe(false);
    expect(isHardwareInstallStateCurrent(installed, installed.shellyId, null)).toBe(false);
  });
});
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s = p.read_text()

s = s.replace(
"""import {
  createInstallPlan,
  hashScriptCode,
  LOCAL_CLIMATE_LINK_SCRIPT_NAME,
  RpcShellyClient,
  RpcShellyScheduleClient,
  type RelayTestResult,
  type ShellyInstallResult
} from '@lcl/shelly-client';""",
"import { LOCAL_CLIMATE_LINK_SCRIPT_NAME } from '@lcl/shelly-client';"
)
s = s.replace("import { useMemo, useState } from 'react';", "import { useMemo, useState } from 'react';")
s = s.replace(
"""import {
  createInstalledAutomation,
  findRelayOwnerConflict,
  type InstalledAutomation
} from '../installations/model.js';
import { useInstalledAutomationStore } from '../installations/store.js';
import { findScheduleRelayConflict } from '../time-automation/runtime.js';
""",
""
)
s = s.replace(
"""  cleanupStaleShellyBleDiscoveryScripts,
  createShellyTransport,
  deleteShellyAutomationScript,
""",
"""  deleteShellyAutomationScript,
"""
)
s = s.replace(
"""  type ShellyAutomationScriptState,
  type ShellyControlStatus,
  unwrapShellyResult
""",
"""  type ShellyAutomationScriptState,
  type ShellyControlStatus
"""
)
anchor = "import { useHardwareDiagnosticsFlow } from './useHardwareDiagnosticsFlow.js';"
assert anchor in s
s = s.replace(
  anchor,
  "import { useClimateAutomationInstallFlow } from './useClimateAutomationInstallFlow.js';\n" + anchor,
  1
)

types_start = s.index("type HardwareInstallState = {")
types_end_marker = """type SafeRelayTestMutationResult = {
  install: HardwareInstallState;
  relayTest: RelayTestResult;
};

"""
types_end = s.index(types_end_marker, types_start) + len(types_end_marker)
s = s[:types_start] + s[types_end:]

stores = """  const installedAutomations = useInstalledAutomationStore(
    (state) => state.installations
  );
  const upsertInstalledAutomation = useInstalledAutomationStore(
    (state) => state.upsertInstallation
  );
"""
assert stores in s
s = s.replace(stores, '', 1)

states = """  const [lastInstallState, setLastInstallState] = useState<HardwareInstallState | null>(
    null
  );
  const [safeRelayTestState, setSafeRelayTestState] =
    useState<HardwareInstallState | null>(null);
"""
assert states in s
s = s.replace(states, '', 1)

hash_start = s.index("  const currentScriptHash = useMemo(")
hash_end_marker = "  const canRunSafeRelayTest = isLastInstallCurrent && !isSafeRelayTestComplete;\n\n"
hash_end = s.index(hash_end_marker, hash_start) + len(hash_end_marker)
s = s[:hash_start] + s[hash_end:]

install_start = s.index("  const installMutation = useMutation({")
install_end_marker = """  const safeRelayTestMutation = useMutation({
"""
safe_start = s.index(install_end_marker, install_start)
# Find end of the safe relay mutation block by the next selection function.
selection_marker = "  const selectShellyDevice = (id: string) => {"
selection_start = s.index(selection_marker, safe_start)
s = s[:install_start] + s[selection_start:]

# Compose the capability hook after rule derivation, where all inputs and diagnostics are available.
rule_marker = """    );

  const checkShellyMutation = useMutation({"""
install_compose = """    );

  const {
    canRunSafeRelayTest,
    installMutation,
    safeRelayTestMutation,
    resetInstallState
  } = useClimateAutomationInstallFlow({
    selectedShelly,
    configState,
    isThresholdValid,
    isVpdAssistValid,
    refreshDiagnostics
  });

  const checkShellyMutation = useMutation({"""
assert rule_marker in s
s = s.replace(rule_marker, install_compose, 1)

# All previous direct state resets become capability resets.
s = s.replace("      setLastInstallState(null);\n      setSafeRelayTestState(null);", "      resetInstallState();")
s = s.replace("    setLastInstallState(null);\n    setSafeRelayTestState(null);", "    resetInstallState();")

p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts \
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts

pnpm --dir apps/mobile exec vitest run \
  src/flows/hardware-setup/useClimateAutomationInstallFlow.test.ts \
  src/__tests__/hardware-setup.test.tsx
pnpm check
LCL_E2E_PORT=5189 pnpm e2e:responsive

git diff --check
LINES=$(wc -l < apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | tr -d ' ')
echo HARDWARE_FLOW_LINES="$LINES"
test "$LINES" -lt 650

git add \
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts \
  apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
git commit -m 'Extract climate automation install flow'
git push origin HEAD:"$BRANCH"

echo STAGE8B4_SHA=$(git rev-parse HEAD)
echo STAGE8B4_PARENT=$(git rev-parse HEAD^)
echo STAGE8B4_CHECK=1
echo STAGE8B4_E2E=1
echo STAGE8B4_FLOW_LINES="$LINES"
test -z "$(git status --porcelain)"
