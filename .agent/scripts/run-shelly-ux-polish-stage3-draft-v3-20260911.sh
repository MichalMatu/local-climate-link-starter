#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-shelly-ux-polish-stage3-draft-20260911.sh > /tmp/shelly-stage3-v3-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/shelly-stage3-v3-inner.sh')
s = p.read_text()
needle = "s = replace_once(s, old_map, new_map, 'saved card props')\np.write_text(s)\n"
injection = """s = replace_once(s, old_map, new_map, 'saved card props')
for old_line in [
    \"  formatAutomationMode,\\n\",
    \"  formatPlugEnergy,\\n\",
    \"  formatPlugPower,\\n\",
    \"  formatPlugVoltage,\\n\",
    \"  formatShellyClock,\\n\",
]:
    if old_line not in s:
        raise SystemExit(f'missing unused import {old_line!r}')
    s = s.replace(old_line, '', 1)
s = replace_once(
    s,
    \"import { mutationError, shellyAddressLabel, type HardwarePageProps } from '../helpers.js';\",
    \"import { mutationError, type HardwarePageProps } from '../helpers.js';\",
    'helper import cleanup'
)
s = replace_once(
    s,
    \"  const shellyAddress = shellyAddressLabel(flow);\\n\",
    '',
    'unused shelly address'
)
p.write_text(s)
"""
if s.count(needle) != 1:
    raise SystemExit(f'page write marker mismatch: {s.count(needle)}')
p.write_text(s.replace(needle, injection, 1))
PY
sh /tmp/shelly-stage3-v3-inner.sh
