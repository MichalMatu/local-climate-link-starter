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
old = """    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    fireEvent.click(within(actionRow).getByRole('button', { name: 'MANUAL' }));
    await screen.findByText('Tryb MANUAL. Przekaźnik OFF.');

    const callsBeforeScan = vi.mocked(fetch).mock.calls.length;
"""
new = """    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const callsBeforeManual = vi.mocked(fetch).mock.calls.length;
    fireEvent.click(within(actionRow).getByRole('button', { name: 'MANUAL' }));
    await waitFor(() => {
      const manualCodes = vi
        .mocked(fetch)
        .mock.calls.slice(callsBeforeManual)
        .map((call) => requestBody(call[1]))
        .filter((body) => body.method === 'Script.Eval')
        .map((body) => (body.params as { code?: string } | undefined)?.code ?? '');
      expect(manualCodes.some((code) => code.includes('R.m=1'))).toBe(true);
    });

    const callsBeforeScan = vi.mocked(fetch).mock.calls.length;
"""
if old not in s:
    raise SystemExit('generated runtime mode test patch anchor missing')
p.write_text(s.replace(old, new, 1))
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
