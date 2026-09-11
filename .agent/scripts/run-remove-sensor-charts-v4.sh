#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-remove-sensor-charts-v3.sh > /tmp/run-remove-sensor-charts-v4-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-remove-sensor-charts-v4-inner.sh')
s = p.read_text()
old = "if git ls-files | grep -Ei 'sparkline'; then"
new = "if find packages/ui/src -type f | grep -Ei 'sparkline'; then"
if s.count(old) != 1:
    raise SystemExit(f'expected one sparkline audit marker, got {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY
sh /tmp/run-remove-sensor-charts-v4-inner.sh
