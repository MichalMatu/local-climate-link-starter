#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=060d5990ca5e68709ab883e6a83137754e34fa22
ORIGINAL=.agent/scripts/stage6d-wheel-time-picker-install-audit-20260912.sh
TMP=/tmp/lcl-stage6d2.sh

# Start only from the exact reviewed Stage 6C base. The previous Stage 6D attempt
# stopped at quality:ux and left only its two expected generated files dirty.
git fetch --prune origin "$BRANCH" agent-control >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$BASE"

if [ -n "$(git status --porcelain)" ]; then
  CHANGED="$(git status --porcelain | sed 's/^...//' | sort)"
  EXPECTED="apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
apps/mobile/src/theme/theme.css"
  test "$CHANGED" = "$EXPECTED"
  grep -q 'data-time-wheel-picker' apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx
  grep -q 'grid-template-columns: repeat(2, minmax(0, 1fr));' apps/mobile/src/theme/theme.css
  git reset --hard HEAD >/dev/null
fi

test -z "$(git status --porcelain)"
git show "origin/agent-control:$ORIGINAL" > "$TMP"

python3 - "$TMP" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
old='grid-template-columns: repeat(2, minmax(0, 1fr));'
new='grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));'
count=s.count(old)
assert count == 1, f'expected one Stage 6D fixed-grid source pattern, got {count}'
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
PY

grep -q 'grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));' "$TMP"
! grep -q 'grid-template-columns: repeat(2, minmax(0, 1fr));' "$TMP"

sh "$TMP"
