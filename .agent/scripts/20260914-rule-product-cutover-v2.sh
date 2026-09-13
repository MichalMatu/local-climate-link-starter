#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=259b82bf55af63d191c0e693c0633a8517c02b84
cd "$REPO"

git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }

# Recreate the already typechecked/tested cutover from its deterministic script.
git show origin/agent-control:.agent/scripts/20260914-rule-product-cutover-v1.sh > /tmp/lcl-rule-product-cutover-v1.sh
bash /tmp/lcl-rule-product-cutover-v1.sh || true

# The v1 cutover is expected to stop at quality:ux because the new production CSS
# has not yet been registered with the token/responsive gate. Refuse to continue
# if the expected cutover files are not present.
[[ -f apps/mobile/src/screens/rules/RuleDetailScreen.css ]] || {
  echo 'Cutover files were not generated'; exit 3;
}

python3 - <<'PY'
from pathlib import Path
p = Path('scripts/quality/ux-gate.mjs')
s = p.read_text()
needle = "  'apps/mobile/src/screens/AutomationDashboardScreen.css',\n"
addition = "  'apps/mobile/src/screens/AutomationDashboardScreen.css',\n  'apps/mobile/src/screens/rules/RuleDetailScreen.css',\n"
if addition not in s:
    if needle not in s:
        raise SystemExit('ux gate cssPaths anchor missing')
    s = s.replace(needle, addition, 1)
p.write_text(s)
PY

pnpm exec prettier --write \
  scripts/quality/ux-gate.mjs \
  apps/mobile/src/screens/rules/rulePresentation.ts \
  apps/mobile/src/screens/rules/RuleCard.tsx \
  apps/mobile/src/screens/rules/RuleRuntimeControls.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.css \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/screens/AutomationDashboardScreen.css \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/__tests__/automation-dashboard.test.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/__tests__/rule-detail.test.tsx

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/__tests__/automation-dashboard.test.tsx \
  src/__tests__/app-routes.test.tsx \
  src/__tests__/rule-detail.test.tsx \
  src/flows/rules/lifecycle.test.ts \
  src/flows/rules/draft.test.ts
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  scripts/quality/ux-gate.mjs \
  apps/mobile/src/screens/rules/rulePresentation.ts \
  apps/mobile/src/screens/rules/RuleCard.tsx \
  apps/mobile/src/screens/rules/RuleRuntimeControls.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.css \
  apps/mobile/src/screens/AutomationDashboardScreen.tsx \
  apps/mobile/src/screens/AutomationDashboardScreen.css \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/__tests__/automation-dashboard.test.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/__tests__/rule-detail.test.tsx \
  apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx

git commit -m 'Cut over product screens to rules'
HEAD=$(git rev-parse HEAD)
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$EXPECTED" ]] || { echo 'Remote moved during product cutover repair'; exit 4; }
git push origin "$HEAD:$BRANCH"
git fetch origin "$BRANCH"
[[ "$(git rev-parse "origin/$BRANCH")" == "$HEAD" ]] || { echo 'Push verification failed'; exit 5; }
echo "FINAL_HEAD=$HEAD"
