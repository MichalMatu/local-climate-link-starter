#!/usr/bin/env bash
set -euo pipefail
git fetch origin agent-control >/dev/null
BASE_SCRIPT=/tmp/lcl-main-canonical-ux-capture-v1.sh
git show origin/agent-control:.agent/scripts/20260914-main-canonical-ux-capture-v1.sh > "$BASE_SCRIPT"
python3 - <<'PY'
p='/tmp/lcl-main-canonical-ux-capture-v1.sh'
s=open(p).read()
old="const closeModal=async()=>{await click('Close',{optional:true});await click('Cancel',{optional:true});await pause(250)};"
new="const closeModal=async()=>{const closed=await click('Close',{optional:true});if(!closed)await click('Cancel',{optional:true});await pause(250)};"
if old not in s:
    raise SystemExit('closeModal source not found')
s=s.replace(old,new)
open('/tmp/lcl-main-canonical-ux-capture-v2-runtime.sh','w').write(s)
PY
bash /tmp/lcl-main-canonical-ux-capture-v2-runtime.sh
