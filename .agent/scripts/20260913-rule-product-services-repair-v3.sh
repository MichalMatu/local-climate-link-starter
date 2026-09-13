#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=7114f0ded9ca3866a5bd20ada8ac7a1d1f67220f
cd "$REPO"

git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$EXPECTED" ]] || { echo 'Unexpected remote head'; exit 2; }

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/flows/rules/draft.test.ts')
s = p.read_text()
old = "import { createRuleDraft, defaultTimeRuleSchedule } from './draft.js';\n"
new = "import { createRuleDraft, defaultTimeRuleSchedule } from './draft.js';\nimport type { RuleSchedule } from './model.js';\n"
if old not in s:
    raise SystemExit('draft test import anchor missing')
s = s.replace(old, new, 1)
old = "    const schedule = {\n      windows: [{ days: [1, 2, 3, 4, 5], start: '06:00', end: '22:00' }]\n    };"
new = "    const schedule: RuleSchedule = {\n      windows: [{ days: [1, 2, 3, 4, 5], start: '06:00', end: '22:00' }]\n    };"
if old not in s:
    raise SystemExit('draft test schedule anchor missing')
s = s.replace(old, new, 1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/lifecycle.ts \
  apps/mobile/src/flows/rules/lifecycle.test.ts \
  apps/mobile/src/flows/rules/draft.ts \
  apps/mobile/src/flows/rules/draft.test.ts \
  apps/mobile/src/flows/rules/useRuleRuntime.ts
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/rules/lifecycle.test.ts \
  src/flows/rules/draft.test.ts \
  src/flows/rules/runtimeOwnership.test.ts \
  src/flows/rules/climateRuntime.test.ts \
  src/flows/rules/timeRuntime.test.ts
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/flows/rules/lifecycle.ts \
  apps/mobile/src/flows/rules/lifecycle.test.ts \
  apps/mobile/src/flows/rules/draft.ts \
  apps/mobile/src/flows/rules/draft.test.ts \
  apps/mobile/src/flows/rules/useRuleRuntime.ts
git commit -m 'Add rule product runtime services'
HEAD=$(git rev-parse HEAD)
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$EXPECTED" ]] || { echo 'Remote moved during product services repair'; exit 4; }
git push origin "$HEAD:$BRANCH"
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$HEAD" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$HEAD"
