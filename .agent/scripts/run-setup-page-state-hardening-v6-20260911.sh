#!/usr/bin/env sh
set -eu

git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/run-setup-page-state-hardening-v5-20260911.sh > /tmp/setup-page-state-hardening-v6-base.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/setup-page-state-hardening-v6-base.sh')
s=p.read_text()
old='sh /tmp/setup-page-state-hardening-v5-inner.sh\n'
new=r'''python3 - <<'PYUXSCRIPT'
from pathlib import Path
p=Path('/tmp/setup-page-state-hardening-v5-inner.sh')
s=p.read_text()
marker="""pnpm exec prettier --write \\
  apps/mobile/src/screens/hardware-setup/useToastQueue.ts \\
"""
patch="""python3 - <<'PYUX'
from pathlib import Path
p=Path('scripts/quality/ux-gate.mjs')
s=p.read_text()
old=\"\"\"    !ruleSource.includes(
      'open={isInstallBlockModalOpen && flow.installMutation.isError}'
    ) ||
    !ruleSource.includes(
      '<FeedbackPanel tone=\\\"danger\\\" title={mutationError(flow.installMutation.error)}>'
    )
\"\"\"
new=\"\"\"    !ruleSource.includes(
      \\\"open={dialog === 'install-block' && flow.installMutation.isError}\\\"
    ) ||
    !ruleSource.includes(\\\"setDialog('install-block');\\\") ||
    !ruleSource.includes(
      '<FeedbackPanel tone=\\\"danger\\\" title={mutationError(flow.installMutation.error)}>'
    )
\"\"\"
if s.count(old)!=1:
    raise SystemExit(f'UX install-block guard marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PYUX

pnpm exec prettier --write \\
  scripts/quality/ux-gate.mjs \\
  apps/mobile/src/screens/hardware-setup/useToastQueue.ts \\
"""
if s.count(marker)!=1:
    raise SystemExit(f'prettier marker mismatch for UX gate injection: {s.count(marker)}')
s=s.replace(marker,patch,1)
commit_marker='git commit -m "refactor(mobile): unify setup page dialog state"\n'
if s.count(commit_marker)!=1:
    raise SystemExit(f'commit marker mismatch: {s.count(commit_marker)}')
s=s.replace(commit_marker, 'git add scripts/quality/ux-gate.mjs\n'+commit_marker,1)
p.write_text(s)
PYUXSCRIPT
sh /tmp/setup-page-state-hardening-v5-inner.sh
'''
if s.count(old)!=1:
    raise SystemExit(f'v5 execution marker mismatch: {s.count(old)}')
s=s.replace(old,new,1)
p.write_text(s)
PY
sh /tmp/setup-page-state-hardening-v6-base.sh
