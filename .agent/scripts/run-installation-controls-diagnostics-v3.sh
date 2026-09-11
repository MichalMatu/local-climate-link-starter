#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-installation-controls-diagnostics-v2.sh > /tmp/run-installation-controls-diagnostics-v3-inner.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-installation-controls-diagnostics-v3-inner.sh')
s = p.read_text()
old_import = "import { useTranslation } from '../app/i18n.js';\n\ntype InstallationRuntimeControlsProps = {"
new_import = "import { useTranslation } from '../app/i18n.js';\nimport type { InstalledAutomationControlMode } from '../flows/installations/runtimeStatus.js';\n\ntype InstallationRuntimeControlsProps = {"
if s.count(old_import) != 1:
    raise SystemExit(f'expected one controls import marker, got {s.count(old_import)}')
s = s.replace(old_import, new_import, 1)
old_type = "  automationMode: 'auto' | 'manual' | null;"
new_type = "  automationMode: InstalledAutomationControlMode | null;"
if s.count(old_type) != 1:
    raise SystemExit(f'expected one automationMode prop marker, got {s.count(old_type)}')
s = s.replace(old_type, new_type, 1)
p.write_text(s)
PY
sh /tmp/run-installation-controls-diagnostics-v3-inner.sh
