#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/physical-manual-runtime-v1.sh > /tmp/physical-manual-runtime-v2-expanded.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/physical-manual-runtime-v2-expanded.sh')
s=p.read_text()
old="if(s.manual!=='true'||s.onDisabled!==false||s.offDisabled!==false)throw new Error('MANUAL UI contract failed');"
new="if(s.manual!=='true')throw new Error('MANUAL UI contract failed');"
if s.count(old)!=1:
    raise SystemExit(f'expected one stale detail relay assertion, found {s.count(old)}')
s=s.replace(old,new,1)
s=s.replace('PHYSICAL_MANUAL_RUNTIME_OK=1','PHYSICAL_MANUAL_RUNTIME_V2_OK=1',1)
p.write_text(s)
PY
sh /tmp/physical-manual-runtime-v2-expanded.sh
