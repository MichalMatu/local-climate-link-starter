#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-shelly-ux-polish-stage3-draft-20260911.sh > /tmp/shelly-stage3-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/shelly-stage3-v2-inner.sh')
s = p.read_text()
# The page no longer renders duplicated everyday metrics; those formatters live in the card.
for line in [
    "  formatAutomationMode,\\n",
    "  formatPlugEnergy,\\n",
    "  formatPlugPower,\\n",
    "  formatPlugVoltage,\\n",
    "  formatShellyClock,\\n",
]:
    if s.count(line) != 1:
        raise SystemExit(f'import marker mismatch for {line!r}: {s.count(line)}')
    s = s.replace(line, '', 1)
old = "import { mutationError, shellyAddressLabel, type HardwarePageProps } from '../helpers.js';"
new = "import { mutationError, type HardwarePageProps } from '../helpers.js';"
if s.count(old) != 1:
    raise SystemExit(f'helper import mismatch: {s.count(old)}')
s = s.replace(old, new, 1)
old = "  const shellyAddress = shellyAddressLabel(flow);\\n"
if s.count(old) != 1:
    raise SystemExit(f'shellyAddress marker mismatch: {s.count(old)}')
s = s.replace(old, '', 1)
p.write_text(s)
PY
sh /tmp/shelly-stage3-v2-inner.sh
