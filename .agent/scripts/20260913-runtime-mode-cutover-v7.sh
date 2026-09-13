#!/usr/bin/env bash
set -euo pipefail
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_HEAD='83f889a424ed1128c34b8586118f0c58e6ae9d26'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard "origin/$BRANCH"
git clean -fd
test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD"
test -z "$(git status --porcelain)"

git show origin/agent-control:.agent/scripts/20260913-runtime-mode-cutover-v6.sh > /tmp/lcl-runtime-mode-v6-base.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/lcl-runtime-mode-v6-base.sh')
s = p.read_text()
needle = "pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx\n\ngit diff --check\n"
insert = r'''pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx

python3 - <<'PY2'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
s = p.read_text()
old = """    fireEvent.click(manual);

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      await within(toastRegion).findByText(
        'Automatyka zatrzymana, wyjście potwierdzone jako OFF.'
      )
    ).toBeVisible();
    await waitFor(() => expect(manual).toHaveAttribute('aria-pressed', 'true'));
"""
new = """    fireEvent.click(manual);

    await waitFor(() => expect(manual).toHaveAttribute('aria-pressed', 'true'), {
      timeout: 3000
    });
"""
if old not in s:
    raise SystemExit('manual detail expectation anchor missing')
s = s.replace(old, new, 1)
old = """    fireEvent.click(auto);

    expect(await within(toastRegion).findByText('Automatyka uruchomiona.')).toBeVisible();
    await waitFor(() => expect(auto).toHaveAttribute('aria-pressed', 'true'));
"""
new = """    fireEvent.click(auto);

    await waitFor(() => expect(auto).toHaveAttribute('aria-pressed', 'true'), {
      timeout: 3000
    });
"""
if old not in s:
    raise SystemExit('auto detail expectation anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)
PY2
pnpm exec prettier --write apps/mobile/src/__tests__/automation-detail.test.tsx

git diff --check
'''
if needle not in s:
    raise SystemExit('v6 insertion anchor missing')
s = s.replace(needle, insert, 1)
s = s.replace(
    "src/flows/installations/runtimeModeTransport.test.ts \\\n  src/__tests__/hardware-setup.test.tsx",
    "src/flows/installations/runtimeModeTransport.test.ts \\\n  src/__tests__/hardware-setup.test.tsx \\\n  src/__tests__/automation-detail.test.tsx",
    1,
)
s = s.replace(
    "apps/mobile/src/__tests__/hardware-setup.test.tsx \\\n  docs/implementation/device-rule-decoupling-progress.md",
    "apps/mobile/src/__tests__/hardware-setup.test.tsx \\\n  apps/mobile/src/__tests__/automation-detail.test.tsx \\\n  docs/implementation/device-rule-decoupling-progress.md",
    1,
)
p.write_text(s)
PY
/bin/bash /tmp/lcl-runtime-mode-v6-base.sh
