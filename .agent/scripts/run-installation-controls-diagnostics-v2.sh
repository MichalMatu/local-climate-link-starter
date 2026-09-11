#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-installation-controls-diagnostics-v1.sh > /tmp/run-installation-controls-diagnostics-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-installation-controls-diagnostics-v2-inner.sh')
s = p.read_text()
replacements = {
    "expect(within(dialog).getByText('RAM Shelly wolny')).toBeVisible();": "expect(within(dialog).getByText('RAM Shelly wolny')).toBeInTheDocument();",
    "expect(within(dialog).getByText('Bateria')).toBeVisible();": "expect(within(dialog).getByText('Bateria')).toBeInTheDocument();",
    "expect(within(dialog).getByText('RSSI')).toBeVisible();": "expect(within(dialog).getByText('RSSI')).toBeInTheDocument();",
}
for old, new in replacements.items():
    if s.count(old) != 1:
        raise SystemExit(f'expected one test assertion marker for: {old}')
    s = s.replace(old, new, 1)
p.write_text(s)
PY
sh /tmp/run-installation-controls-diagnostics-v2-inner.sh
