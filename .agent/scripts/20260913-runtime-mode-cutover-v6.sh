#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='83f889a424ed1128c34b8586118f0c58e6ae9d26'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard "origin/$BRANCH"
git clean -fd
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-runtime-mode-cutover.sh > /tmp/lcl-runtime-mode-cutover-base.sh
set +e
bash /tmp/lcl-runtime-mode-cutover-base.sh
base_rc=$?
set -e
test "$base_rc" -ne 0

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()
start = s.index("  it('restores MANUAL runtime mode after temporary Shelly BLE discovery'")
end = s.index("  it('removes a stale BLE discovery script before starting a new Shelly BLE scan'", start)
replacement = """  it('restores MANUAL runtime mode after temporary Shelly BLE discovery', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = requestBody(init);
        if (body.method === 'Script.Eval') {
          const code = (body.params as { code?: string } | undefined)?.code ?? '';
          if (code.includes('typeof R')) {
            return rpcResult({ result: '1' });
          }
        }
        return defaultFetch(input, init);
      })
    );

    const callsBeforeScan = vi.mocked(fetch).mock.calls.length;
    await openShellyBleScanFromSettings();
    const dialog = await screen.findByRole('dialog', { name: 'Skanuj termometry BLE' });
    expect(await findBleScanCandidate(dialog)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));

    await waitFor(() => {
      const bodies = vi
        .mocked(fetch)
        .mock.calls.slice(callsBeforeScan)
        .map((call) => requestBody(call[1]));
      const restartIndex = bodies.findIndex(
        (body) =>
          body.method === 'Script.Start' &&
          (body.params as { id?: number } | undefined)?.id === 1
      );
      expect(restartIndex).toBeGreaterThanOrEqual(0);
      const restoreCodes = bodies
        .slice(restartIndex + 1)
        .filter((body) => body.method === 'Script.Eval')
        .map((body) => (body.params as { code?: string } | undefined)?.code ?? '');
      expect(restoreCodes.some((code) => code.includes('R.m=1'))).toBe(true);
    });
  });

"""
s = s[:start] + replacement + s[end:]
p.write_text(s)
PY
pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx

git diff --check
pnpm --dir apps/mobile exec vitest run \
  src/flows/installations/runtimeModeTransport.test.ts \
  src/__tests__/hardware-setup.test.tsx
pnpm quality:repo
pnpm typecheck

python3 - <<'PY'
from pathlib import Path
p=Path('docs/implementation/device-rule-decoupling-progress.md')
s=p.read_text()
entry="""
### Runtime mode checkpoint — canonical R.m and BLE restoration

- Extracted shared Shelly runtime-mode `Script.Eval` transport so setup and installed-runtime paths use the same `R.m` protocol.
- Normal AUTO/MANUAL control no longer uses `Script.Stop` / `Script.Start`; MANUAL keeps the managed thermostat script running and forces relay OFF.
- A stopped thermostat script is now represented separately from MANUAL instead of being treated as MANUAL.
- Temporary Shelly BLE discovery records the prior AUTO/MANUAL state and restores that exact `R.m` mode after restarting the temporarily stopped automation script.
- Added focused coverage proving normal mode changes avoid Script.Stop/Start and BLE discovery restores MANUAL.
- Focused runtime/hardware-setup tests, repository gate and workspace typecheck passed before commit.

Exact next step: move climate/time creation and dashboard persistence from `InstalledAutomation`/device draft snapshots to the dedicated rule/device registries, then remove legacy product callers.
"""
if entry.strip() not in s:
    s += entry
p.write_text(s)
PY
pnpm exec prettier --write docs/implementation/device-rule-decoupling-progress.md
git diff --check

git add \
  apps/mobile/src/flows/hardware-setup/shellyRuntimeMode.ts \
  apps/mobile/src/flows/installations/runtimeModeTransport.ts \
  apps/mobile/src/flows/hardware-setup/shellyRequests.ts \
  apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts \
  apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts \
  apps/mobile/src/__tests__/hardware-setup.test.tsx \
  docs/implementation/device-rule-decoupling-progress.md
git commit -m 'Preserve runtime mode across BLE discovery'
git push origin HEAD:"$BRANCH"
test -z "$(git status --porcelain)"
echo RUNTIME_MODE_HEAD=$(git rev-parse HEAD)
