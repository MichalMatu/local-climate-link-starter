#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca

git fetch --prune origin "$BRANCH"
git checkout "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

# The previous deterministic stage intentionally stopped at the UX gate and left its edits unstaged.
# Refuse to proceed if the local worktree does not contain that known interrupted stage.
test -n "$(git status --porcelain)"
test -f apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q 'size="workspace"' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
grep -q 'scan-loading-state' apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx

python3 <<'PY'
from pathlib import Path

# Introduce a semantic task modal: full-height on mobile, content-sized on wider screens.
p = Path('packages/ui/src/primitives/Modal.tsx')
s = p.read_text()
s = s.replace(
    "  size?: 'default' | 'diagnostic' | 'workspace';",
    "  size?: 'default' | 'diagnostic' | 'task' | 'workspace';",
    1,
)
p.write_text(s)

p = Path('packages/ui/src/styles.css')
s = p.read_text()
s = s.replace(
    ".lcl-modal-backdrop--diagnostic,\n.lcl-modal-backdrop--workspace {",
    ".lcl-modal-backdrop--diagnostic,\n.lcl-modal-backdrop--task,\n.lcl-modal-backdrop--workspace {",
    1,
)
s = s.replace(
    ".lcl-modal--diagnostic .lcl-modal__body,\n.lcl-modal--workspace .lcl-modal__body {",
    ".lcl-modal--diagnostic .lcl-modal__body,\n.lcl-modal--task .lcl-modal__body,\n.lcl-modal--workspace .lcl-modal__body {",
    1,
)
s = s.replace(
    "  .lcl-modal-backdrop--diagnostic,\n  .lcl-modal-backdrop--workspace {",
    "  .lcl-modal-backdrop--diagnostic,\n  .lcl-modal-backdrop--task,\n  .lcl-modal-backdrop--workspace {",
    1,
)
s = s.replace(
    "  .lcl-modal--diagnostic,\n  .lcl-modal--workspace {\n    height: calc(100dvh - (var(--lcl-spacing-sm) * 2));\n  }",
    "  .lcl-modal--diagnostic,\n  .lcl-modal--task,\n  .lcl-modal--workspace {\n    height: calc(100dvh - (var(--lcl-spacing-sm) * 2));\n  }",
    1,
)
p.write_text(s)

# The workflow modals from interrupted stage use semantic task size instead of ScriptPreview workspace size.
for rel in [
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
]:
    p = Path(rel)
    s = p.read_text().replace('size="workspace"', 'size="task"')
    # Progress is visible inline but is deliberately not a second live-region/toast channel.
    s = s.replace(' className="scan-loading-state scan-loading-state--compact" role="status"',
                  ' className="scan-loading-state scan-loading-state--compact"')
    s = s.replace(' className="scan-loading-state" role="status"',
                  ' className="scan-loading-state"')
    p.write_text(s)

# Placeholder values must retain the final metric typography so the card cannot grow when BLE data arrives.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
old = """.sensor-data-metric-card--empty .sensor-data-metric-card__value,\n.sensor-data-metric-card__value--empty {\n  color: var(--lcl-color-text-muted);\n  font-size: var(--lcl-font-size-lg);\n  opacity: var(--lcl-opacity-muted);\n}\n"""
new = """.sensor-data-metric-card--empty .sensor-data-metric-card__value,\n.sensor-data-metric-card__value--empty {\n  color: var(--lcl-color-text-muted);\n  opacity: var(--lcl-opacity-muted);\n}\n"""
if old not in s:
    raise SystemExit('expected empty sensor metric style not found')
s = s.replace(old, new, 1)
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

# Ensure only intended UX files changed before committing.
CHANGED=$(git diff --name-only | sort)
printf '%s\n' "$CHANGED"
for f in $(printf '%s\n' "$CHANGED"); do
  case "$f" in
    apps/mobile/src/app/locales/de.ts|apps/mobile/src/app/locales/en.ts|apps/mobile/src/app/locales/es.ts|apps/mobile/src/app/locales/fr.ts|apps/mobile/src/app/locales/it.ts|apps/mobile/src/app/locales/pl.ts|apps/mobile/src/app/locales/ptBr.ts|apps/mobile/src/components/AppBottomNavigation.css|apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx|apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx|apps/mobile/src/theme/theme.css|packages/ui/src/primitives/Modal.tsx|packages/ui/src/styles.css) ;;
    *) echo "Unexpected changed file: $f" >&2; exit 1 ;;
  esac
done

# Full repository verification after focused checks.
pnpm check

git add \
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

git diff --cached --check
git commit -m "Unify mobile setup task flows"
git push origin "$BRANCH"

SHA=$(git rev-parse HEAD)
printf 'STAGE5_SHA=%s\n' "$SHA"
printf 'STAGE5_PARENT=%s\n' "$(git rev-parse HEAD^)"
printf 'STAGE5_BUILD=1\n'
test -z "$(git status --porcelain)"
