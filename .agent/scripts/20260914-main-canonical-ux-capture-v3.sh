#!/usr/bin/env bash
set -euo pipefail
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/20260914-main-canonical-ux-capture-v1.sh > /tmp/lcl-main-canonical-ux-capture-base.sh
python3 - <<'PY'
p='/tmp/lcl-main-canonical-ux-capture-base.sh'
s=open(p).read()
old="const closeModal=async()=>{await click('Close',{optional:true});await click('Cancel',{optional:true});await pause(250)};"
new="const closeModal=async()=>{const closed=await ev(`(()=>{const b=document.querySelector('.lcl-modal__close');if(!b)return false;b.click();return true})()`);if(!closed)throw new Error('No modal close button');await pause(300)};"
if old not in s: raise SystemExit('closeModal source not found')
s=s.replace(old,new)
s=s.replace("if(onButton){await pause();await capture('10-time-wheel-picker','Custom HH/MM wheel picker with fade and centered selection.');await click('Cancel');}", "if(onButton){await pause();await capture('10-time-wheel-picker','Custom HH/MM wheel picker with fade and centered selection.');await closeModal();}")
open('/tmp/lcl-main-canonical-ux-capture-v3-runtime.sh','w').write(s)
PY
bash /tmp/lcl-main-canonical-ux-capture-v3-runtime.sh
