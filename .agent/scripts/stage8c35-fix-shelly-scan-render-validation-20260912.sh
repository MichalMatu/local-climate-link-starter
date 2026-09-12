#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='c8c9d9b3546884ddfe3f0fe9de3d495dfc45e3ee'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts')
s = p.read_text()
s = s.replace("import { useMemo, useRef, useState } from 'react';", "import { useRef, useState } from 'react';")
old = """  const scanBaseUrls = useMemo(
    () =>
      buildUnsavedShellyScanUrls(shellyDevices, shellyScanStartInput, shellyScanEndInput),
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
"""
new = """  const shellyScanMutation = useMutation({
    mutationFn: async (): Promise<ShellySetupScanOutcome> => {
      setShellyScanStopped(false);
      const controller = new AbortController();
      shellyScanAbortControllerRef.current = controller;
      try {
        const scanBaseUrls = buildUnsavedShellyScanUrls(
          shellyDevices,
          shellyScanStartInput,
          shellyScanEndInput
        );
        return await scanShellySetupUrls({
          baseUrls: scanBaseUrls,
          signal: controller.signal
        });
"""
assert old in s
s = s.replace(old, new, 1)
p.write_text(s)

p = Path('apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts')
s = p.read_text()
s = s.replace("import { describe, expect, it } from 'vitest';", "import { QueryClient, QueryClientProvider } from '@tanstack/react-query';\nimport { act, renderHook } from '@testing-library/react';\nimport { createElement, type PropsWithChildren } from 'react';\nimport { describe, expect, it } from 'vitest';")
s = s.replace("import { buildUnsavedShellyScanUrls } from './useShellySetupScanFlow.js';", "import {\n  buildUnsavedShellyScanUrls,\n  useShellySetupScanFlow\n} from './useShellySetupScanFlow.js';")
insert = """

  it('allows an incomplete scan address while the user is editing without crashing render', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result } = renderHook(() => useShellySetupScanFlow([]), { wrapper });

    act(() => {
      result.current.setShellyScanStartInput('192.168.0.');
    });

    expect(result.current.shellyScanStartInput).toBe('192.168.0.');
    queryClient.clear();
  });
"""
marker = "\n});\n"
idx = s.rfind(marker)
assert idx != -1
s = s[:idx] + insert + s[idx:]
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts

pnpm --dir apps/mobile exec vitest run src/flows/hardware-setup/useShellySetupScanFlow.test.ts
pnpm check
LCL_E2E_PORT=5195 pnpm e2e:responsive

git diff --check
git add \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts
git commit -m 'Avoid validating Shelly scan range during render'
git push origin HEAD:"$BRANCH"

echo STAGE8C35_SHA=$(git rev-parse HEAD)
echo STAGE8C35_PARENT=$(git rev-parse HEAD^)
echo STAGE8C35_CHECK=1
echo STAGE8C35_E2E=1
test -z "$(git status --porcelain)"
