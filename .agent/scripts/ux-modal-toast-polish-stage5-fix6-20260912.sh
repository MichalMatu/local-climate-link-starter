#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

# Continue the exact failed fix5 worktree. If the daemon cleaned it, deterministically
# reproduce fix5 until its expected typecheck stop, then continue from that state.
if test -z "$(git status --porcelain)"; then
  git show origin/agent-control:.agent/scripts/ux-modal-toast-polish-stage5-fix5-20260912.sh > /tmp/lcl-stage5-fix5.sh
  set +e
  sh /tmp/lcl-stage5-fix5.sh
  RC=$?
  set -e
  test "$RC" -eq 2
  test "$(git rev-parse HEAD)" = "$BASE"
fi

test -n "$(git status --porcelain)"

python3 <<'PY'
from pathlib import Path
import re

p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()

# The progress-toast helper was intentionally removed, but one now-empty success
# effect still referenced it in the dependency list. Remove that redundant effect.
pattern = re.compile(
    r"\n\s*useEffect\(\(\) => \{\s*if \(!flow\.shellyScanMutation\.isSuccess\) \{\s*return;\s*\}\s*\}, \[dismissShellyScanProgressToast, flow\.shellyScanMutation\.isSuccess\]\);\s*",
    re.S,
)
s2, n = pattern.subn('\n', s, count=1)
if n != 1:
    raise SystemExit(f'expected one redundant Shelly scan success effect, got {n}')
p.write_text(s2)
PY

pnpm exec prettier --write apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
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
