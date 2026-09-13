#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE_REMOTE=fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895
FAILCLOSED=6876bbcf

cd "$REPO"
git fetch origin "$BRANCH" agent-control
REMOTE_HEAD=$(git rev-parse "origin/$BRANCH")
if [[ "$REMOTE_HEAD" != "$BASE_REMOTE" ]]; then
  echo "Remote branch moved unexpectedly: $REMOTE_HEAD"
  exit 2
fi
if ! git cat-file -e "${FAILCLOSED}^{commit}" 2>/dev/null; then
  echo "Missing local fail-closed commit $FAILCLOSED"
  exit 3
fi

git checkout "$BRANCH"
git reset --hard "$FAILCLOSED"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Checkout is not clean"
  exit 4
fi

python3 - <<'PY'
from pathlib import Path
p = Path('packages/automation-core/src/__tests__/schedule.test.ts')
s = p.read_text()
needle = "  it('evaluates same-day and cross-midnight windows using the starting weekday', () => {"
if needle not in s:
    raise SystemExit('schedule test anchor missing')
insert = """  it('fails closed for malformed clock input and invalid windows', () => {\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: '08:00', end: '10:00' }] },\n        1,\n        'not-a-time'\n      )\n    ).toBe(false);\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: 'bad', end: '10:00' }] },\n        1,\n        '09:00'\n      )\n    ).toBe(false);\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: '08:00', end: 'bad' }] },\n        1,\n        '09:00'\n      )\n    ).toBe(false);\n    expect(\n      isRuleScheduleActive(\n        { windows: [{ days: [1], start: '08:00', end: '08:00' }] },\n        1,\n        '08:00'\n      )\n    ).toBe(false);\n  });\n\n"""
if "fails closed for malformed clock input and invalid windows" not in s:
    s = s.replace(needle, insert + needle)
p.write_text(s)
PY

pnpm exec prettier --write packages/automation-core/src/__tests__/schedule.test.ts
pnpm --filter @lcl/automation-core test:coverage
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
pnpm quality:ux

git add packages/automation-core/src/__tests__/schedule.test.ts
if git diff --cached --quiet; then
  echo "No coverage test changes to commit"
  exit 5
fi
git commit -m "Cover rule schedule fail-closed branches"
NEW_HEAD=$(git rev-parse HEAD)
PARENT=$(git rev-parse HEAD^)
if [[ "$PARENT" != $(git rev-parse "$FAILCLOSED") ]]; then
  echo "Unexpected parent $PARENT"
  exit 6
fi

git push origin "HEAD:$BRANCH"
git fetch origin "$BRANCH"
PUSHED=$(git rev-parse "origin/$BRANCH")
if [[ "$PUSHED" != "$NEW_HEAD" ]]; then
  echo "Push verification failed: local=$NEW_HEAD remote=$PUSHED"
  exit 7
fi
printf 'PUSHED_HEAD=%s\n' "$PUSHED"
