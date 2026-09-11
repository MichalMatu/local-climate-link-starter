#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-navigation-ux-consistency-v5.sh > /tmp/run-navigation-ux-consistency-v6-inner.sh

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-navigation-ux-consistency-v6-inner.sh')
s = p.read_text()
old = "page.getByRole('button', { name: 'Czas' })).toHaveAttribute("
new = "page.getByRole('button', { name: 'Czas', exact: true })).toHaveAttribute("
if s.count(old) != 2:
    raise SystemExit(f'Czas selector count mismatch: {s.count(old)}')
s = s.replace(old, new)
old = "page.getByRole('button', { name: 'Ustawienia' })).toBeVisible();"
new = "page.getByRole('button', { name: 'Ustawienia', exact: true })).toBeVisible();"
if s.count(old) != 2:
    raise SystemExit(f'Ustawienia selector count mismatch: {s.count(old)}')
s = s.replace(old, new)
p.write_text(s)
PY

sh /tmp/run-navigation-ux-consistency-v6-inner.sh
