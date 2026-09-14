#!/usr/bin/env bash
set -euo pipefail

cd /Users/michal/agent-workspace/repos/local-climate-link-starter/work
EXPECTED_HEAD="1594e3621d87c8879619f75125e51c17bf0dfc72"
ACTUAL_HEAD="$(git rev-parse HEAD)"
if [[ "$ACTUAL_HEAD" != "$EXPECTED_HEAD" ]]; then
  echo "Unexpected HEAD: $ACTUAL_HEAD" >&2
  exit 2
fi

# The previous quick-fix stopped at pre-commit and intentionally left its staged edits in place.
git status --short

python3 - <<'PY'
from pathlib import Path

css = Path('apps/mobile/src/theme/theme.css')
s = css.read_text()
old = 'grid-template-columns: repeat(2, minmax(0, 1fr));'
new = '''grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, 8rem), 1fr)
  );'''
if old not in s:
    raise SystemExit('Expected fixed two-column grid from quick-fix not found')
s = s.replace(old, new, 1)
css.write_text(s)

p = Path('apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx')
s = p.read_text()
# Keep the picker initialization effect stable without re-centering on every wheel scroll.
# The lint warning only concerns values used to choose the initial center.
old_candidates = [
    '  }, [editingTime]);',
    '  }, [editingTime, state.start, state.end]);',
]
replacement = '  }, [draftHour, draftMinute, editingTime]);'
for old in old_candidates:
    if old in s:
        s = s.replace(old, replacement, 1)
        break
else:
    # Show the relevant hook region for deterministic diagnosis rather than guessing further.
    start = s.find('useEffect(')
    print(s[start:start+1200])
    raise SystemExit('Expected quick-fix useEffect dependency array not found')
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx apps/mobile/src/theme/theme.css
pnpm exec eslint apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck

git add apps/mobile/src/screens/rules/editor/RuleScheduleFields.tsx apps/mobile/src/theme/theme.css
git commit -m "Refine schedule editor controls"
git push origin HEAD:work/device-rule-decoupling-20260913
FINAL_HEAD="$(git rev-parse HEAD)"
echo "FINAL_HEAD=$FINAL_HEAD"
