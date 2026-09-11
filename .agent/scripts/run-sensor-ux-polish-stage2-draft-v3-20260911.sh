#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-sensor-ux-polish-stage2-draft-20260911.sh > /tmp/sensor-stage2-v3-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/sensor-stage2-v3-inner.sh')
s = p.read_text()
old = "  grid-template-columns: repeat(2, minmax(0, 1fr));\\n"
new = "  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));\\n"
if s.count(old) != 1:
    raise SystemExit(f'grid marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY
sh /tmp/sensor-stage2-v3-inner.sh
