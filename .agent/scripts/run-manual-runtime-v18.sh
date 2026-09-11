#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v16.sh > /tmp/run-manual-runtime-v18-driver.sh

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v18-driver.sh')
s = p.read_text()
needle = "insert = '''# Register the device-status RPC centrally instead of scattering an untyped method name.\n"
if needle not in s:
    raise SystemExit('v18 could not locate v16 insertion block')
replacement = "insert = '''# Keep the full-dashboard recovery fixture on the live 0.2 runtime contract.\nreplace_once(\n    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',\n    \"    default:\\n      return {};\\n  }\\n};\",\n    \"    case 'Script.Eval':\\n      return { result: '0' };\\n    default:\\n      return {};\\n  }\\n};\",\n)\n\n# Register the device-status RPC centrally instead of scattering an untyped method name.\n"
s = s.replace(needle, replacement, 1)
s = s.replace('MANUAL_RUNTIME_V16_SHA', 'MANUAL_RUNTIME_V18_SHA')
p.write_text(s)
PY

sh /tmp/run-manual-runtime-v18-driver.sh
