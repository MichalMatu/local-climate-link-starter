#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-setup-page-state-hardening-v2-20260911.sh > /tmp/setup-page-state-hardening-v3-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/setup-page-state-hardening-v3-inner.sh')
s=p.read_text()
old="s=s.replace('        setIsAddShellyModalOpen(false);', \"        setDialog({ kind: 'none' });\")\n"
new="s=s.replace('setIsAddShellyModalOpen(false)', \"setDialog({ kind: 'none' })\")\ns=s.replace('setIsAddShellyModalOpen(true)', \"setDialog({ kind: 'add' })\")\n"
if s.count(old)!=1:
    raise SystemExit(f'Shelly fixer marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh /tmp/setup-page-state-hardening-v3-inner.sh
