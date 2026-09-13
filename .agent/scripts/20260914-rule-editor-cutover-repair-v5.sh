#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=88d37a265445d9a5de235aada1508e85d2d6ea65
cd "$REPO"

git fetch origin "$BRANCH" agent-control
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

git show origin/agent-control:.agent/scripts/20260914-rule-editor-cutover-v1.sh > /tmp/lcl-rule-editor-v1.sh
(bash /tmp/lcl-rule-editor-v1.sh || true)
git show origin/agent-control:.agent/scripts/20260914-rule-editor-cutover-repair-v2.sh > /tmp/lcl-rule-editor-v2.sh
(bash /tmp/lcl-rule-editor-v2.sh || true)

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/rule-editor.test.tsx')
s = p.read_text()
old_label = "screen.getByLabelText('Nazwa')"
new_label = "screen.getByRole('textbox', { name: /Nazwa/ })"
count = s.count(old_label)
if count < 1:
    raise SystemExit('Expected at least one exact name label query')
s = s.replace(old_label, new_label)
if old_label in s:
    raise SystemExit('Exact name label query still present')

anchor = "import type { AutomationRule } from '../flows/rules/model.js';\n"
type_import = "import type * as RuleLifecycle from '../flows/rules/lifecycle.js';\n"
if type_import not in s:
    if anchor not in s:
        raise SystemExit('Rule lifecycle type import anchor missing')
    s = s.replace(anchor, anchor + type_import)
old_dynamic = "importOriginal<typeof import('../flows/rules/lifecycle.js')>()"
new_static = "importOriginal<typeof RuleLifecycle>()"
if old_dynamic not in s:
    raise SystemExit('Dynamic lifecycle type import missing')
s = s.replace(old_dynamic, new_static)
if "typeof import('../flows/rules/lifecycle.js')" in s:
    raise SystemExit('Dynamic lifecycle type import still present')
p.write_text(s)
print(f'Replaced {count} exact name label queries and staticized lifecycle mock typing')
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
pnpm lint
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
