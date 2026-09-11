#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-remove-sensor-charts-v3.sh > /tmp/run-remove-sensor-charts-v5-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-remove-sensor-charts-v5-inner.sh')
s = p.read_text()
old_audit = "if git ls-files | grep -Ei 'sparkline'; then"
new_audit = "if find packages/ui/src -type f | grep -Ei 'sparkline'; then"
if s.count(old_audit) != 1:
    raise SystemExit(f'expected one sparkline audit marker, got {s.count(old_audit)}')
s = s.replace(old_audit, new_audit, 1)
marker = "python3 /tmp/remove-sensor-charts-v2-fix.py\n"
responsive_patch = r'''python3 - <<'PYCSS'
from pathlib import Path
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
old = 'grid-template-columns: repeat(2, minmax(0, 1fr));'
new = 'grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));'
if s.count(old) != 1:
    raise SystemExit(f'expected one fixed sensor metric grid, got {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PYCSS
'''
if s.count(marker) != 1:
    raise SystemExit(f'expected one patch marker, got {s.count(marker)}')
s = s.replace(marker, marker + responsive_patch, 1)
p.write_text(s)
PY
sh /tmp/run-remove-sensor-charts-v5-inner.sh
