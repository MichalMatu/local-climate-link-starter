#!/bin/sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-manual-runtime-v9.sh > /tmp/run-manual-runtime-v10-expanded.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-manual-runtime-v10-expanded.sh')
s = p.read_text()
needle = "pnpm exec prettier --write \\\n"
patch = r'''python3 - <<'PY2'
from pathlib import Path
p = Path('packages/script-generator/src/__tests__/manual-runtime.test.ts')
s = p.read_text()
s = s.replace(
    "keeps runtime control compact and uses diagnostics as the mode source of truth",
    "keeps runtime control compact and exposes mode through runtime state",
    1,
)
old = "    expect(script).toContain('md:0');\n    expect(script).toContain('md:R.m');\n"
new = "    expect(script).toContain('m:0');\n    expect(script).not.toContain('md:');\n"
if old not in s:
    raise SystemExit('v10 could not locate obsolete diagnostics-mode assertions')
p.write_text(s.replace(old, new, 1))
PY2

'''
if needle not in s:
    raise SystemExit('v10 could not locate prettier stage in v9 runner')
s = s.replace(needle, patch + needle, 1)
s = s.replace('MANUAL_RUNTIME_V9_SHA=', 'MANUAL_RUNTIME_V10_SHA=', 1)
p.write_text(s)
PY
sh /tmp/run-manual-runtime-v10-expanded.sh
