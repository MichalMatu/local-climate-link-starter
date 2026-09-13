#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
cd "$REPO"
git fetch origin agent-control work/device-rule-decoupling-20260913
git show origin/agent-control:.agent/scripts/20260913-rule-runtime-foundation.sh > /tmp/lcl-rule-runtime-foundation-base.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/lcl-rule-runtime-foundation-base.sh')
s = p.read_text()
old = '''BRANCH='work/device-rule-decoupling-20260913'\nEXPECTED_PARENT='fbbde9abb37fe9fcdbce5c7cdc8f3bdd98e3d895'\ngit fetch origin "$BRANCH" agent-control\nBASE="$(git rev-parse "origin/$BRANCH")"\nMESSAGE="$(git log -1 --pretty=%s "$BASE")"\nPARENT="$(git rev-parse "$BASE^")"\nif [ "$MESSAGE" != 'Fail closed on unknown climate runtime mode' ] || [ "$PARENT" != "$EXPECTED_PARENT" ]; then\n  echo "Expected fail-closed checkpoint, got $BASE '$MESSAGE' parent $PARENT" >&2\n  exit 1\nfi\ngit reset --hard "$BASE"\ngit checkout -B "$BRANCH" "$BASE"\n'''
new = '''BRANCH='work/device-rule-decoupling-20260913'\nFAILCLOSED='6876bbcf'\ngit fetch origin "$BRANCH" agent-control\nBASE="$(git rev-parse "origin/$BRANCH")"\nif ! git merge-base --is-ancestor "$FAILCLOSED" "$BASE"; then\n  echo "Expected fail-closed checkpoint $FAILCLOSED to be an ancestor of $BASE" >&2\n  exit 1\nfi\ngit reset --hard "$BASE"\ngit checkout -B "$BRANCH" "$BASE"\n'''
if old not in s:
    raise SystemExit('foundation guard block did not match expected source')
p.write_text(s.replace(old, new, 1))
PY
bash /tmp/lcl-rule-runtime-foundation-base.sh
