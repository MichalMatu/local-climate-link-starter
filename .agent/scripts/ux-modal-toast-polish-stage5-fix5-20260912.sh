#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca

git fetch --prune origin "$BRANCH" agent-control
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

# A failed task may leave the reviewed draft/fix in the worktree or the runner may
# clean it. Reconstruct deterministically when needed.
if test -z "$(git status --porcelain)"; then
  git show origin/agent-control:.agent/scripts/ux-modal-toast-polish-stage5-20260912.sh > /tmp/lcl-stage5-draft.sh
  set +e
  sh /tmp/lcl-stage5-draft.sh
  DRAFT_RC=$?
  set -e
  test "$DRAFT_RC" -eq 1
fi

test "$(git rev-parse HEAD)" = "$BASE"
test -n "$(git status --porcelain)"

python3 <<'PY'
from pathlib import Path
import re

# Semantic full-height-on-mobile task modal. Apply only if not already present.
p = Path('packages/ui/src/primitives/Modal.tsx')
s = p.read_text()
if "'task'" not in s:
    old = "  size?: 'default' | 'diagnostic' | 'workspace';"
    if old not in s:
        raise SystemExit('Modal size union marker not found')
    s = s.replace(old, "  size?: 'default' | 'diagnostic' | 'task' | 'workspace';", 1)
p.write_text(s)

p = Path('packages/ui/src/styles.css')
s = p.read_text()
repls = [
    (
        ".lcl-modal-backdrop--diagnostic,\n.lcl-modal-backdrop--workspace {",
        ".lcl-modal-backdrop--diagnostic,\n.lcl-modal-backdrop--task,\n.lcl-modal-backdrop--workspace {",
    ),
    (
        ".lcl-modal--diagnostic .lcl-modal__body,\n.lcl-modal--workspace .lcl-modal__body {",
        ".lcl-modal--diagnostic .lcl-modal__body,\n.lcl-modal--task .lcl-modal__body,\n.lcl-modal--workspace .lcl-modal__body {",
    ),
    (
        "  .lcl-modal-backdrop--diagnostic,\n  .lcl-modal-backdrop--workspace {",
        "  .lcl-modal-backdrop--diagnostic,\n  .lcl-modal-backdrop--task,\n  .lcl-modal-backdrop--workspace {",
    ),
    (
        "  .lcl-modal--diagnostic,\n  .lcl-modal--workspace {\n    height: calc(100dvh - (var(--lcl-spacing-sm) * 2));\n  }",
        "  .lcl-modal--diagnostic,\n  .lcl-modal--task,\n  .lcl-modal--workspace {\n    height: calc(100dvh - (var(--lcl-spacing-sm) * 2));\n  }",
    ),
]
for old, new in repls:
    if new not in s:
        if old not in s:
            raise SystemExit(f'UI modal style marker not found: {old[:48]}')
        s = s.replace(old, new, 1)
p.write_text(s)

for rel in [
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
]:
    p = Path(rel)
    s = p.read_text().replace('size="workspace"', 'size="task"')
    p.write_text(s)

# Progress stays visible inside the active task surface, but must not create a
# second transient live-region channel beside ToastViewport.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
s = re.sub(
    r'(<div\s+className="scan-loading-state(?: scan-loading-state--compact)?")\s+role="status"',
    r'\1',
    s,
)
if 'role="status"' in s or 'role="alert"' in s:
    raise SystemExit('inline live-region role remains in Shelly setup page')
p.write_text(s)
PY

pnpm exec prettier --write \
  packages/ui/src/primitives/Modal.tsx \
  packages/ui/src/styles.css \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/components/AppBottomNavigation.css \
  apps/mobile/src/app/locales/pl.ts \
  apps/mobile/src/app/locales/en.ts \
  apps/mobile/src/app/locales/de.ts \
  apps/mobile/src/app/locales/es.ts \
  apps/mobile/src/app/locales/fr.ts \
  apps/mobile/src/app/locales/it.ts \
  apps/mobile/src/app/locales/ptBr.ts

pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build

CHANGED=$(git diff --name-only | sort)
printf '%s\n' "$CHANGED"
for f in $CHANGED; do
  case "$f" in
    apps/mobile/src/app/locales/de.ts|apps/mobile/src/app/locales/en.ts|apps/mobile/src/app/locales/es.ts|apps/mobile/src/app/locales/fr.ts|apps/mobile/src/app/locales/it.ts|apps/mobile/src/app/locales/pl.ts|apps/mobile/src/app/locales/ptBr.ts|apps/mobile/src/components/AppBottomNavigation.css|apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx|apps/mobile/src/theme/theme.css|packages/ui/src/primitives/Modal.tsx|packages/ui/src/styles.css) ;;
    *) echo "Unexpected changed file: $f" >&2; exit 1 ;;
  esac
done

pnpm check

git add $CHANGED
git diff --cached --check
git commit -m "Unify mobile setup task flows"
git push origin "$BRANCH"

SHA=$(git rev-parse HEAD)
printf 'STAGE5_SHA=%s\n' "$SHA"
printf 'STAGE5_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE5_BUILD=1\n'
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"
