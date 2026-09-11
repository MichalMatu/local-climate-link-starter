#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-setup-page-state-hardening-v3-20260911.sh > /tmp/setup-page-state-hardening-v4-base.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/setup-page-state-hardening-v4-base.sh')
s=p.read_text()
old='sh /tmp/setup-page-state-hardening-v3-inner.sh\n'
new=r'''python3 - <<'PYINNER'
from pathlib import Path
p=Path('/tmp/setup-page-state-hardening-v3-inner.sh')
s=p.read_text()
marker="""pnpm exec prettier --write \\
  apps/mobile/src/screens/hardware-setup/useToastQueue.ts \\
"""
fix="""python3 - <<'PYDEAD'
from pathlib import Path
p=Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s=p.read_text()
old=\"\"\"  const removeSensor = (device: SensorDraftDevice) => {
    setDialog({ kind: 'remove', device });
  };

\"\"\"
if s.count(old)!=1:
    raise SystemExit(f'removeSensor dead-wrapper marker mismatch: {s.count(old)}')
s=s.replace(old,'',1)
p.write_text(s)
PYDEAD

pnpm exec prettier --write \\
  apps/mobile/src/screens/hardware-setup/useToastQueue.ts \\
"""
if s.count(marker)!=1:
    raise SystemExit(f'prettier marker mismatch for dead-wrapper fix: {s.count(marker)}')
s=s.replace(marker,fix,1)
p.write_text(s)
PYINNER
sh /tmp/setup-page-state-hardening-v3-inner.sh
'''
if s.count(old)!=1:
    raise SystemExit(f'v3 execution marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh /tmp/setup-page-state-hardening-v4-base.sh
