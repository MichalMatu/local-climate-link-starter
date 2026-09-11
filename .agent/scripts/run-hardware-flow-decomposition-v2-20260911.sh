#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-hardware-flow-decomposition-v1-20260911.sh > /tmp/hardware-flow-decomposition-v2-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/hardware-flow-decomposition-v2-inner.sh')
s=p.read_text()
# ShellyAutomationDeleteMutationResult still carries ShellyControlStatus, so keep that type import.
s=s.replace("  '  type ShellyControlStatus,\\n'\n", '')
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
sh /tmp/hardware-flow-decomposition-v2-inner.sh
