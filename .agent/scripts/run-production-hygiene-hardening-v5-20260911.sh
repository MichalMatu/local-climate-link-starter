#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-production-hygiene-hardening-v4-20260911.sh > /tmp/production-hygiene-v5-inner.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/production-hygiene-v5-inner.sh')
s=p.read_text()
old="  const selectIntent = (intent: SetupIntent, sourceKind: AppNavigationKind) => {\n"
new="  const selectIntent = (intent: SetupIntent) => {\n"
if s.count(old)!=1: raise SystemExit(f'selectIntent signature marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
old="        onSelect={(intent) => selectIntent(intent, route.sourceKind)}\n"
new="        onSelect={selectIntent}\n"
if s.count(old)!=1: raise SystemExit(f'selectIntent call marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh /tmp/production-hygiene-v5-inner.sh
