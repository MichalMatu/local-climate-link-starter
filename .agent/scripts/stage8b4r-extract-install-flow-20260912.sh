#!/usr/bin/env bash
set -euo pipefail

git fetch origin agent-control

git show origin/agent-control:.agent/scripts/stage8b4-extract-install-flow-20260912.sh > /tmp/lcl-stage8b4r-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/lcl-stage8b4r-inner.sh')
s = p.read_text()
old = '''rule_marker = """    );\n\n  const checkShellyMutation = useMutation({"""'''
new = '''rule_marker = """    );\n  const checkShellyMutation = useMutation({"""'''
assert old in s
s = s.replace(old, new, 1)
p.write_text(s)
PY

bash /tmp/lcl-stage8b4r-inner.sh
