#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-hardware-flow-decomposition-v1-20260911.sh > /tmp/hardware-flow-decomposition-v3-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/hardware-flow-decomposition-v3-inner.sh')
s=p.read_text()
# Keep the control status type: script load/delete state still carries it.
s=s.replace("  '  type ShellyControlStatus,\\n'\n", '')
# Candidate/snapshot types are now private to the extracted BLE hooks.
needle="s=s.replace('  generateShellyBleDiscoveryScript,\\n', '')"
replacement=needle+"\ns=s.replace('  type BleDiscoveryCandidate,\\n', '')\ns=s.replace('  type BleDiscoverySnapshot,\\n', '')"
if s.count(needle)!=1: raise SystemExit(f'import injection marker mismatch: {s.count(needle)}')
s=s.replace(needle,replacement,1)
old="""# Remove old Shelly control implementation but preserve script load/delete logic.
start=s.find('  const setShellyControlState = (')
end=s.find('  const loadAutomationScriptMutation = useMutation({', start)
if start==-1 or end==-1 or end<=start: raise SystemExit('control implementation boundaries not found')
s=s[:start]+s[end:]
"""
new="""# Remove only subsystem-owned control helpers/mutations. Keep Shelly check/recheck/network scan in the parent orchestrator.
start=s.find('  const setShellyControlState = (')
end=s.find('  const checkShellyMutation = useMutation({', start)
if start==-1 or end==-1 or end<=start: raise SystemExit('control helper boundaries not found')
s=s[:start]+s[end:]
start=s.find('  const refreshShellyControlMutation = useMutation({')
end=s.find('  const loadAutomationScriptMutation = useMutation({', start)
if start==-1 or end==-1 or end<=start: raise SystemExit('control mutation boundaries not found')
s=s[:start]+s[end:]
"""
if s.count(old)!=1: raise SystemExit(f'v1 control boundary marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh /tmp/hardware-flow-decomposition-v3-inner.sh
