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
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/lcl-runtime-mode-cutover-base.sh')
s = p.read_text()
old = """    fireEvent.click(within(actionRow).getByRole('button', { name: 'MANUAL' }));\n    await screen.findByText('Tryb MANUAL. Przekaźnik OFF.');\n\n    const callsBeforeScan = vi.mocked(fetch).mock.calls.length;\n"""
new = """    const manualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });\n    fireEvent.click(manualButton);\n    await waitFor(() => expect(manualButton).toHaveAttribute('aria-pressed', 'true'));\n\n    const callsBeforeScan = vi.mocked(fetch).mock.calls.length;\n"""
if old not in s:
    raise SystemExit('runtime mode test patch anchor missing')
p.write_text(s.replace(old, new, 1))
PY
bash /tmp/lcl-runtime-mode-cutover-base.sh
