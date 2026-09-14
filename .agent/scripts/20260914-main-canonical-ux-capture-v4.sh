#!/usr/bin/env bash
set -euo pipefail
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/20260914-main-canonical-ux-capture-v3.sh > /tmp/lcl-main-canonical-ux-capture-v3-base.sh
python3 - <<'PY'
p='/tmp/lcl-main-canonical-ux-capture-v3-base.sh'
s=open(p).read()
# Patch the base v1 payload embedded by v3 before v3 applies its own runtime patches.
s=s.replace("s=s.replace(old,new)\n", "s=s.replace(old,new)\ns=s.replace(\"await click('Control humidity');\", \"await click('Control humidity',{starts:true});\")\n")
open('/tmp/lcl-main-canonical-ux-capture-v4-runtime.sh','w').write(s)
PY
bash /tmp/lcl-main-canonical-ux-capture-v4-runtime.sh
