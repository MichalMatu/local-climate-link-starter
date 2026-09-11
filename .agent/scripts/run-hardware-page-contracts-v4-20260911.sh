#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-hardware-page-contracts-v3-20260911.sh > /tmp/hardware-page-contracts-v4-wrapper.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/hardware-page-contracts-v4-wrapper.sh')
s=p.read_text()
old='sh /tmp/hardware-page-contracts-v3-inner.sh\n'
patch="""python3 - <<'PY2'
from pathlib import Path
p=Path('/tmp/hardware-page-contracts-v3-inner.sh')
s=p.read_text()
s=s.replace('([A-Za-z_$][\\\\w$]*)(?:,|:)', '([A-Za-z_$][\\\\w$]*)(?:,|:|$)')
p.write_text(s)
PY2
sh /tmp/hardware-page-contracts-v3-inner.sh
"""
if s.count(old)!=1: raise SystemExit(f'v3 execution marker mismatch: {s.count(old)}')
s=s.replace(old,patch,1)
p.write_text(s)
PY
sh /tmp/hardware-page-contracts-v4-wrapper.sh
