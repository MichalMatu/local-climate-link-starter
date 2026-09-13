#!/usr/bin/env bash
set -euo pipefail

cd /Users/michal/agent-workspace/repos/local-climate-link-starter/work
git fetch origin agent-control
git show origin/agent-control:.agent/scripts/20260913-rule-product-services-v1.sh > /tmp/lcl-rule-product-services-v2-base.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/lcl-rule-product-services-v2-base.sh')
s = p.read_text()
old = "days: [1, 2, 3, 4, 5] as const, start: '06:00', end: '22:00'"
new = "days: [1, 2, 3, 4, 5], start: '06:00', end: '22:00'"
if old not in s:
    raise SystemExit('draft schedule fixture anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)
PY
bash /tmp/lcl-rule-product-services-v2-base.sh
