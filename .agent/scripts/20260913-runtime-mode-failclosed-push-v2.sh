#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BRANCH='work/device-rule-decoupling-20260913'
EXPECTED_REMOTE='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'
CANDIDATE='6876bbcf659a952be90c9f3a0968d3d5ab414cf5'
git fetch origin "$BRANCH" agent-control
REMOTE_HEAD="$(git rev-parse "origin/$BRANCH")"
[ "$REMOTE_HEAD" = "$EXPECTED_REMOTE" ] || { echo "Remote head changed: $REMOTE_HEAD" >&2; exit 1; }
git cat-file -e "$CANDIDATE^{commit}"
git checkout -B "$BRANCH" "$CANDIDATE"
python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
s=p.read_text()
anchor='''      <div\n        className="shelly-runtime-controls"\n        aria-label={t('hardware.shelly.controlLabel', { name: device.name })}\n      >'''
insert='''      {automationMode === 'missing' && (\n        <p className="shelly-runtime-controls__hint" role="status">\n          {t('hardware.rule.automationScriptMissing')}\n        </p>\n      )}\n\n'''
if insert.strip() not in s:
    if anchor not in s:
        raise SystemExit('runtime controls anchor not found')
    s=s.replace(anchor,insert+anchor,1)
p.write_text(s)
PY
pnpm exec prettier --write apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
pnpm --filter @lcl/mobile test -- src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
git add apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx
git commit --amend --no-edit
FINAL_HEAD="$(git rev-parse HEAD)"
PARENT="$(git rev-parse HEAD^)"
[ "$PARENT" = "$EXPECTED_REMOTE" ] || { echo "Amended parent mismatch: $PARENT" >&2; exit 1; }
git push origin "$FINAL_HEAD:refs/heads/$BRANCH"
echo "PUSHED_HEAD=$FINAL_HEAD"
