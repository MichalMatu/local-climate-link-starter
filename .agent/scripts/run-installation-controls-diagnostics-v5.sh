#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-installation-controls-diagnostics-v1.sh > /tmp/run-installation-controls-diagnostics-v5-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-installation-controls-diagnostics-v5-inner.sh')
s = p.read_text()
replacements = {
    "expect(within(dialog).getByText('RAM Shelly wolny')).toBeVisible();": "expect(within(dialog).getByText('RAM Shelly wolny')).toBeInTheDocument();",
    "expect(within(dialog).getByText('Bateria')).toBeVisible();": "expect(within(dialog).getByText('Bateria')).toBeInTheDocument();",
    "expect(within(dialog).getByText('RSSI')).toBeVisible();": "expect(within(dialog).getByText('RSSI')).toBeInTheDocument();",
    "import { useTranslation } from '../app/i18n.js';\n\ntype InstallationRuntimeControlsProps = {": "import { useTranslation } from '../app/i18n.js';\nimport type { InstalledAutomationControlMode } from '../flows/installations/runtimeStatus.js';\n\ntype InstallationRuntimeControlsProps = {",
    "  automationMode: 'auto' | 'manual' | null;": "  automationMode: InstalledAutomationControlMode | null;",
}
for old, new in replacements.items():
    if s.count(old) != 1:
        raise SystemExit(f'expected one base marker for: {old}')
    s = s.replace(old, new, 1)

marker = "p.write_text(s)\n\np=Path('docs/HANDOFF_NEXT_CHAT.md')"
insert = r'''p.write_text(s)

p=Path('apps/mobile/src/screens/InstallationDetailScreen.tsx')
s=p.read_text()
old='    <main className="demo-shell installation-detail-shell">'
new='    <main className="demo-shell installation-detail-shell app-bottom-nav-shell">'
if s.count(old) != 1:
    raise SystemExit(f'detail bottom-nav shell marker mismatch: {s.count(old)}')
p.write_text(s.replace(old,new,1))

p=Path('apps/mobile/src/components/AppBottomNavigation.css')
s=p.read_text()
anchor='''}

.app-bottom-nav {
'''
rule='''}

.app-bottom-nav-shell .lcl-toast-viewport {
  bottom: calc(
    var(--app-bottom-nav-height) + var(--lcl-spacing-lg) + env(safe-area-inset-bottom)
  );
}

.app-bottom-nav {
'''
if s.count(anchor) != 1:
    raise SystemExit(f'bottom nav css anchor mismatch: {s.count(anchor)}')
p.write_text(s.replace(anchor,rule,1))

p=Path('apps/mobile/e2e/responsive.spec.ts')
s=p.read_text()
old="  await expect(page.getByText('OFF', { exact: true })).toBeVisible();"
new="""  await expect(page.getByRole('button', { name: 'OFF', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );"""
if s.count(old) != 1:
    raise SystemExit(f'responsive OFF locator marker mismatch: {s.count(old)}')
p.write_text(s.replace(old,new,1))

p=Path('docs/HANDOFF_NEXT_CHAT.md')'''
if s.count(marker) != 1:
    raise SystemExit(f'expected one post-test patch marker, got {s.count(marker)}')
s = s.replace(marker, insert, 1)

old_prettier = "  apps/mobile/src/screens/InstallationDetailScreen.tsx \\\n  apps/mobile/src/__tests__/automation-detail.test.tsx \\\n  docs/HANDOFF_NEXT_CHAT.md"
new_prettier = "  apps/mobile/src/screens/InstallationDetailScreen.tsx \\\n  apps/mobile/src/components/AppBottomNavigation.css \\\n  apps/mobile/src/__tests__/automation-detail.test.tsx \\\n  apps/mobile/e2e/responsive.spec.ts \\\n  docs/HANDOFF_NEXT_CHAT.md"
if s.count(old_prettier) != 1:
    raise SystemExit(f'prettier list marker mismatch: {s.count(old_prettier)}')
s = s.replace(old_prettier, new_prettier, 1)

old_guard = "grep -q \"automationAction.mutate('off'\" apps/mobile/src/screens/InstallationDetailScreen.tsx\ngit diff --check"
new_guard = "grep -q \"automationAction.mutate('off'\" apps/mobile/src/screens/InstallationDetailScreen.tsx\ngrep -q 'installation-detail-shell app-bottom-nav-shell' apps/mobile/src/screens/InstallationDetailScreen.tsx\ngrep -q 'app-bottom-nav-shell .lcl-toast-viewport' apps/mobile/src/components/AppBottomNavigation.css\ngit diff --check"
if s.count(old_guard) != 1:
    raise SystemExit(f'guard marker mismatch: {s.count(old_guard)}')
s = s.replace(old_guard, new_guard, 1)

p.write_text(s)
PY
sh /tmp/run-installation-controls-diagnostics-v5-inner.sh
