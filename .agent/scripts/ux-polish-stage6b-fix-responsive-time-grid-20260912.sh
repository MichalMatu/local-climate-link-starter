#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=a7b08d97f88750247823d8393ed53a26c90034d9

git fetch --prune origin "$BRANCH" agent-control
test "$(git rev-parse HEAD)" = "$BASE"
test "$(git branch --show-current)" = "$BRANCH"
test -n "$(git status --porcelain)"

# Continue the exact Stage 6B dirty state left by the failed quality gate.
grep -q 'className="primary-action setup-add-fab"' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q 'className="primary-action setup-add-fab"' apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
grep -q 'className="time-schedule-time-input"' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
grep -q 'grid-template-columns: repeat(2, minmax(0, 1fr));' apps/mobile/src/theme/theme.css

python3 <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
old = '  grid-template-columns: repeat(2, minmax(0, 1fr));\n'
new = '''  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)\n  );\n'''
if s.count(old) != 1:
    raise SystemExit(f'expected one fixed time grid, got {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx \
  apps/mobile/src/theme/theme.css

pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/__tests__/hardware-setup.test.tsx
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build
pnpm check

CHANGED="$(git diff --name-only | sort)"
printf '%s\n' "$CHANGED"
for f in $CHANGED; do
  case "$f" in
    apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx|apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx|apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx|apps/mobile/src/theme/theme.css) ;;
    *) echo "Unexpected changed file: $f" >&2; exit 1 ;;
  esac
done

git add $CHANGED
git diff --cached --check
git commit -m "Polish device add and time controls"
git push origin "$BRANCH"
SHA="$(git rev-parse HEAD)"
test "$(git rev-parse HEAD^)" = "$BASE"
test -z "$(git status --porcelain)"
printf 'STAGE6B_SHA=%s\n' "$SHA"
printf 'STAGE6B_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE6B_BUILD=1\n'
