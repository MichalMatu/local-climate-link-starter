#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-installation-controls-diagnostics-v4.sh > /tmp/run-installation-controls-diagnostics-v6-base.sh

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-installation-controls-diagnostics-v6-base.sh')
s = p.read_text()
old = "sh /tmp/run-installation-controls-diagnostics-v4-inner.sh\n"
patch = r"""python3 - <<'PYUX'
from pathlib import Path
p = Path('/tmp/run-installation-controls-diagnostics-v4-inner.sh')
s = p.read_text()

marker = "PY\n\npnpm exec prettier --write"
ux_block = """PY

python3 - <<'PYDETAIL'
from pathlib import Path

p = Path('apps/mobile/src/screens/InstallationDetailScreen.tsx')
s = p.read_text()
old = '    <main className=\"demo-shell installation-detail-shell\">'
new = '    <main className=\"demo-shell installation-detail-shell app-bottom-nav-shell\">'
if s.count(old) != 1:
    raise SystemExit(f'detail bottom-nav shell marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1))

p = Path('apps/mobile/src/components/AppBottomNavigation.css')
s = p.read_text()
old = "}\n\n.app-bottom-nav {\n"
new = "}\n\n.app-bottom-nav-shell .lcl-toast-viewport {\n  bottom: calc(\n    var(--app-bottom-nav-height) + var(--lcl-spacing-lg) + env(safe-area-inset-bottom)\n  );\n}\n\n.app-bottom-nav {\n"
if s.count(old) != 1:
    raise SystemExit(f'bottom-nav CSS marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1))

p = Path('apps/mobile/e2e/responsive.spec.ts')
s = p.read_text()
old = "  await expect(page.getByText('OFF', { exact: true })).toBeVisible();"
new = "  await expect(page.getByRole('button', { name: 'OFF', exact: true })).toHaveAttribute(\n    'aria-pressed',\n    'true'\n  );"
if s.count(old) != 1:
    raise SystemExit(f'responsive OFF locator marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PYDETAIL

pnpm exec prettier --write"""
if s.count(marker) != 1:
    raise SystemExit(f'runner prettier marker mismatch: {s.count(marker)}')
s = s.replace(marker, ux_block, 1)

old_prettier = "  apps/mobile/src/screens/InstallationDetailScreen.tsx \\\n  apps/mobile/src/__tests__/automation-detail.test.tsx \\\n  docs/HANDOFF_NEXT_CHAT.md"
new_prettier = "  apps/mobile/src/screens/InstallationDetailScreen.tsx \\\n  apps/mobile/src/components/AppBottomNavigation.css \\\n  apps/mobile/src/__tests__/automation-detail.test.tsx \\\n  apps/mobile/e2e/responsive.spec.ts \\\n  docs/HANDOFF_NEXT_CHAT.md"
if s.count(old_prettier) != 1:
    raise SystemExit(f'runner prettier list mismatch: {s.count(old_prettier)}')
s = s.replace(old_prettier, new_prettier, 1)

old_guard = "grep -q \"automationAction.mutate('off'\" apps/mobile/src/screens/InstallationDetailScreen.tsx\ngit diff --check"
new_guard = "grep -q \"automationAction.mutate('off'\" apps/mobile/src/screens/InstallationDetailScreen.tsx\ngrep -q 'installation-detail-shell app-bottom-nav-shell' apps/mobile/src/screens/InstallationDetailScreen.tsx\ngrep -q 'app-bottom-nav-shell .lcl-toast-viewport' apps/mobile/src/components/AppBottomNavigation.css\ngit diff --check"
if s.count(old_guard) != 1:
    raise SystemExit(f'runner guard marker mismatch: {s.count(old_guard)}')
s = s.replace(old_guard, new_guard, 1)

old_full = "echo '=== FULL VALIDATION ==='\npnpm check:full"
new_full = "echo '=== FOCUSED E2E REGRESSION ==='\npnpm exec playwright test -c apps/mobile/playwright.config.ts apps/mobile/e2e/led-settings.spec.ts apps/mobile/e2e/responsive.spec.ts --grep 'PLUGS_UI LED relay-state and off presets work end to end|installed automation detail safely pauses and resumes on phone'\n\necho '=== FULL VALIDATION ==='\npnpm check:full"
if s.count(old_full) != 1:
    raise SystemExit(f'runner full-validation marker mismatch: {s.count(old_full)}')
s = s.replace(old_full, new_full, 1)

old_add = "git add apps/mobile/src docs/HANDOFF_NEXT_CHAT.md"
new_add = "git add apps/mobile/src apps/mobile/e2e/responsive.spec.ts docs/HANDOFF_NEXT_CHAT.md"
if s.count(old_add) != 1:
    raise SystemExit(f'runner git-add marker mismatch: {s.count(old_add)}')
s = s.replace(old_add, new_add, 1)

p.write_text(s)
PYUX

sh /tmp/run-installation-controls-diagnostics-v4-inner.sh
"""
if s.count(old) != 1:
    raise SystemExit(f'v4 execution marker mismatch: {s.count(old)}')
p.write_text(s.replace(old, patch, 1))
PY

sh /tmp/run-installation-controls-diagnostics-v6-base.sh
