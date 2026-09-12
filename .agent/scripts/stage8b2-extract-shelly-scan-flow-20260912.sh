#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='cef168d769eb94e8688bd53a19bea7d2e8b81888'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

cat > apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts <<'EOF'
import { useMutation } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { scanShellySetupUrls, type ShellySetupScanOutcome } from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';
import { createIpv4RangeScanUrls, normalizeShellyUrl } from './validation.js';

export const buildUnsavedShellyScanUrls = (
  devices: ShellyDraftDevice[],
  startInput: string,
  endInput: string
): string[] => {
  const savedBaseUrls = new Set<string>();
  for (const device of devices) {
    try {
      savedBaseUrls.add(normalizeShellyUrl(device.baseUrl));
    } catch {
      savedBaseUrls.add(device.baseUrl);
    }
  }

  return createIpv4RangeScanUrls(startInput, endInput).filter(
    (baseUrl) => !savedBaseUrls.has(baseUrl)
  );
};

export const useShellySetupScanFlow = (shellyDevices: ShellyDraftDevice[]) => {
  const [shellyScanStartInput, setShellyScanStartInput] = useState('192.168.0.1');
  const [shellyScanEndInput, setShellyScanEndInput] = useState('192.168.0.99');
  const [shellyScanStopped, setShellyScanStopped] = useState(false);
  const shellyScanAbortControllerRef = useRef<AbortController | null>(null);

  const scanBaseUrls = useMemo(
    () => buildUnsavedShellyScanUrls(shellyDevices, shellyScanStartInput, shellyScanEndInput),
    [shellyDevices, shellyScanEndInput, shellyScanStartInput]
  );

  const shellyScanMutation = useMutation({
    mutationFn: async (): Promise<ShellySetupScanOutcome> => {
      setShellyScanStopped(false);
      const controller = new AbortController();
      shellyScanAbortControllerRef.current = controller;
      try {
        return await scanShellySetupUrls({
          baseUrls: scanBaseUrls,
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

  return {
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan
  };
};
EOF

cat > apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { buildUnsavedShellyScanUrls } from './useShellySetupScanFlow.js';

const device = (id: string, baseUrl: string) => ({
  id,
  name: id,
  baseUrl,
  scriptIdInput: '1'
});

describe('Shelly setup scan derivation', () => {
  it('excludes already saved devices from the requested IPv4 range', () => {
    expect(
      buildUnsavedShellyScanUrls(
        [device('saved', '192.168.0.2')],
        '192.168.0.1',
        '192.168.0.3'
      )
    ).toEqual(['http://192.168.0.1/', 'http://192.168.0.3/']);
  });

  it('preserves the full range when saved entries are outside it', () => {
    expect(
      buildUnsavedShellyScanUrls(
        [device('other', 'http://192.168.1.2/')],
        '192.168.0.1',
        '192.168.0.2'
      )
    ).toEqual(['http://192.168.0.1/', 'http://192.168.0.2/']);
  });
});
EOF

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts')
s = p.read_text()
s = s.replace("import { useMemo, useRef, useState } from 'react';", "import { useMemo, useState } from 'react';")
s = s.replace(
"""  readShellyAutomationScriptState,
  readShellySetupStatus,
  scanShellySetupUrls,
  type ShellyAutomationScriptState,
  type ShellyControlStatus,
  type ShellySetupScanOutcome,
  unwrapShellyResult
""",
"""  readShellyAutomationScriptState,
  readShellySetupStatus,
  type ShellyAutomationScriptState,
  type ShellyControlStatus,
  unwrapShellyResult
"""
)
s = s.replace(
"""import {
  createIpv4RangeScanUrls,
  normalizeShellyUrl,
  toNumberOrFallback
} from './validation.js';""",
"import { toNumberOrFallback } from './validation.js';"
)
needle = "import { useShellyControlFlow } from './useShellyControlFlow.js';"
# Current import is multiline; insert before it using a stable exact closing block.
anchor = """import {
  shellyControlStatusFromSetupStatus,
  useShellyControlFlow
} from './useShellyControlFlow.js';"""
replacement = """import { useShellySetupScanFlow } from './useShellySetupScanFlow.js';
import {
  shellyControlStatusFromSetupStatus,
  useShellyControlFlow
} from './useShellyControlFlow.js';"""
assert anchor in s
s = s.replace(anchor, replacement, 1)

state_block = """  const [shellyScanStartInput, setShellyScanStartInput] = useState('192.168.0.1');
  const [shellyScanEndInput, setShellyScanEndInput] = useState('192.168.0.99');
  const [shellyScanStopped, setShellyScanStopped] = useState(false);
  const shellyScanAbortControllerRef = useRef<AbortController | null>(null);
"""
assert state_block in s
s = s.replace(state_block, '', 1)

saved_block = """  const savedShellyScanBaseUrls = useMemo(() => {
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

"""
assert saved_block in s
s = s.replace(saved_block, '', 1)

phone_anchor = """  } = usePhoneSensorFlow(sensorDevices);

  const clearDiagnosticSnapshot = () => {"""
scan_insert = """  } = usePhoneSensorFlow(sensorDevices);
  const {
    shellyScanStartInput,
    setShellyScanStartInput,
    shellyScanEndInput,
    setShellyScanEndInput,
    shellyScanStopped,
    shellyScanMutation,
    startShellyScan,
    stopShellyScan,
    resetShellyScan
  } = useShellySetupScanFlow(shellyDevices);

  const clearDiagnosticSnapshot = () => {"""
assert phone_anchor in s
s = s.replace(phone_anchor, scan_insert, 1)

start = s.index("  const shellyScanMutation = useMutation({")
end_marker = """  const resetShellyScan = () => {
    stopShellyScan();
    setShellyScanStopped(false);
    shellyScanMutation.reset();
  };

"""
end = s.index(end_marker, start) + len(end_marker)
s = s[:start] + s[end:]

p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts

pnpm --dir apps/mobile exec vitest run src/flows/hardware-setup/useShellySetupScanFlow.test.ts
pnpm check:full

git diff --check
LINES=$(wc -l < apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts | tr -d ' ')
echo HARDWARE_FLOW_LINES="$LINES"
test "$LINES" -lt 810

git add \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts \
  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
git commit -m 'Extract Shelly setup scan flow'
git push origin HEAD:"$BRANCH"

echo STAGE8B2_SHA=$(git rev-parse HEAD)
echo STAGE8B2_PARENT=$(git rev-parse HEAD^)
echo STAGE8B2_CHECK_FULL=1
echo STAGE8B2_FLOW_LINES="$LINES"
test -z "$(git status --porcelain)"
