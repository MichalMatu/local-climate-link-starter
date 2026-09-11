#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
git checkout "$BRANCH" >/dev/null

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
old = "  grid-template-columns: repeat(2, minmax(0, 1fr));"
new = """  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, 12rem), 1fr)\n  );"""
if s.count(old) != 1:
    raise SystemExit(f'expected one fixed grid, got {s.count(old)}')
p.write_text(s.replace(old, new, 1))
PY

pnpm exec prettier --write apps/mobile/src/theme/theme.css
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
set +e
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx
TEST_EXIT=$?
set -e

echo SENSOR_STAGE2_DRAFT_V2_TEST_EXIT=$TEST_EXIT
git diff --check
git status --short
exit $TEST_EXIT
