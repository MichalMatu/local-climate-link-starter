#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=88d37a265445d9a5de235aada1508e85d2d6ea65
cd "$REPO"

git fetch origin "$BRANCH"
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }

python3 - <<'PY'
from pathlib import Path
path = Path('apps/mobile/src/screens/rules/RuleEditorScreen.tsx')
text = path.read_text()
old = "useRuleEditorFlow({ intent, ruleId })"
new = "useRuleEditorFlow({ ...(intent ? { intent } : {}), ...(ruleId ? { ruleId } : {}) })"
if old not in text:
    raise SystemExit('Expected RuleEditorScreen hook call not found')
path.write_text(text.replace(old, new, 1))
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/rules/editor.ts \
  apps/mobile/src/flows/rules/editor.test.ts \
  apps/mobile/src/flows/rules/useRuleEditorFlow.ts \
  apps/mobile/src/screens/rules/editor/RuleIdentityFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleThresholdFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx \
  apps/mobile/src/screens/rules/RuleEditorScreen.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/__tests__/rule-editor.test.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/app/locales/de.ts \
  apps/mobile/src/app/locales/en.ts \
  apps/mobile/src/app/locales/es.ts \
  apps/mobile/src/app/locales/fr.ts \
  apps/mobile/src/app/locales/it.ts \
  apps/mobile/src/app/locales/pl.ts \
  apps/mobile/src/app/locales/ptBr.ts

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/rules/editor.test.ts \
  src/flows/rules/draft.test.ts \
  src/flows/rules/lifecycle.test.ts \
  src/__tests__/rule-editor.test.tsx \
  src/__tests__/rule-detail.test.tsx \
  src/__tests__/automation-dashboard.test.tsx \
  src/__tests__/app-routes.test.tsx
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/flows/rules/editor.ts \
  apps/mobile/src/flows/rules/editor.test.ts \
  apps/mobile/src/flows/rules/useRuleEditorFlow.ts \
  apps/mobile/src/screens/rules/editor/RuleIdentityFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleThresholdFields.tsx \
  apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx \
  apps/mobile/src/screens/rules/RuleEditorScreen.tsx \
  apps/mobile/src/screens/rules/RuleDetailScreen.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/__tests__/rule-editor.test.tsx \
  apps/mobile/src/__tests__/app-routes.test.tsx \
  apps/mobile/src/app/locales/de.ts \
  apps/mobile/src/app/locales/en.ts \
  apps/mobile/src/app/locales/es.ts \
  apps/mobile/src/app/locales/fr.ts \
  apps/mobile/src/app/locales/it.ts \
  apps/mobile/src/app/locales/pl.ts \
  apps/mobile/src/app/locales/ptBr.ts

git commit -m "Cut over rule editor to registries"

git fetch origin "$BRANCH"
REMOTE_AFTER=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE_AFTER" == "$EXPECTED" ]] || { echo "Remote head changed before push: $REMOTE_AFTER"; exit 4; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse "origin/$BRANCH")
echo "FINAL_HEAD=$FINAL_HEAD"
