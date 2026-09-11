#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-rule-ux-polish-stage1-20260911.sh > /tmp/run-rule-ux-polish-stage1-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-rule-ux-polish-stage1-v2-inner.sh')
s = p.read_text()
old = 'Shelly Przedpokój uruchomi się ponownie'
new = 'Shelly Salon uruchomi się ponownie'
count = s.count(old)
if count != 2:
    raise SystemExit(f'expected two summary test expectations, got {count}')
p.write_text(s.replace(old, new))
PY
sh /tmp/run-rule-ux-polish-stage1-v2-inner.sh
