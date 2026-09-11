#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-navigation-ux-consistency-v5.sh > /tmp/run-navigation-ux-consistency-v7-inner.sh

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-navigation-ux-consistency-v7-inner.sh')
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

marker = """if s.count(old) != 1:
    raise SystemExit(f'hardware bottom-nav assertion marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

p.write_text(s)
PY
"""
insertion = """if s.count(old) != 1:
    raise SystemExit(f'hardware bottom-nav assertion marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

old = \"  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toBeVisible();\"
new = \"  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toHaveCount(0);\"
if s.count(old) != 1:
    raise SystemExit(f'time-detail legacy-back marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

p.write_text(s)
PY
"""
if s.count(marker) != 1:
    raise SystemExit(f'v5 patch insertion marker mismatch: {s.count(marker)}')
s = s.replace(marker, insertion, 1)

p.write_text(s)
PY

sh /tmp/run-navigation-ux-consistency-v7-inner.sh
