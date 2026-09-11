#!/usr/bin/env sh
set -eu

BASE=d91da6045524d9ca6657f92d5b8b040502a3f1ae
FEATURE=8012d21e57d27f07b070f3e64b3432eb7b4abe2e
BRANCH=work/navigation-ux-consistency-20260911

git fetch --prune origin
test "$(git rev-parse origin/main)" = "$BASE"
test "$(git rev-parse origin/$BRANCH)" = "$FEATURE"
git checkout -B "$BRANCH" "origin/$BRANCH"

python3 - <<'PY'
from pathlib import Path
p = Path('docs/HANDOFF_NEXT_CHAT.md')
s = p.read_text()

old = """Last behavior-changing `main` commit before this documentation cleanup:

```text
16d8627b9df050152a72f021e2ab3a228cffefb3
feat(mobile): add installation controls and diagnostics
```"""
new = """Latest behavior-changing implementation checkpoint pending final merge:

```text
8012d21e57d27f07b070f3e64b3432eb7b4abe2e
refactor(mobile): unify navigation and setup UX
```"""
if s.count(old) != 1:
    raise SystemExit(f'baseline marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

old = "- intent-first entry, dashboard, stable installation detail and shared bottom navigation,"
new = "- dashboard-first entry with Add automation opened only from `+`, stable installation detail and shared bottom navigation,"
if s.count(old) != 1:
    raise SystemExit(f'completed-state marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

marker = "## Next agreed vertical slice — Shelly LED configuration"
if s.count(marker) != 1:
    raise SystemExit(f'next-slice marker mismatch: {s.count(marker)}')
section = """## Navigation UX consistency tranche (2026-09-11)

Completed and validated in `8012d21e57d27f07b070f3e64b3432eb7b4abe2e`:

- zero-installation state now stays on the normal `Twoje automatyki` dashboard instead of auto-opening setup,
- the Add automation intent picker opens only from the dashboard `+` action,
- removing the final automation returns to the empty dashboard rather than reopening setup,
- the legacy global top-right Settings trigger was removed; app Settings are entered through the shared bottom navigation,
- Add automation and hardware setup retain the global `Klimat / Czas / Ustawienia` navigation while preserving their local setup tabs,
- the Add automation picker no longer exposes the obsolete `Zarządzaj istniejącą automatyką` choice,
- the source dashboard tab is preserved when opening/cancelling Add automation,
- time-installation detail now follows the same global bottom-navigation pattern as climate detail and no longer uses the legacy text `Wróć do automatyki` action,
- the installation-not-found state also exposes the shared bottom navigation,
- Android Back is consistent: setup → intent → dashboard → app exit,
- page-title sizing for the intent picker now follows the normal app-page hierarchy instead of the oversized hero heading,
- device-specific Shelly settings controls remain unchanged and are intentionally distinct from app-level Settings.

Validation for this tranche is green: mobile unit/integration suite, typecheck, lint, `quality:ux`, `quality:repo`, build and the full responsive Playwright matrix (**25/25**) all passed. No Shelly runtime, generated automation script, BLE ownership or LED behavior was changed by this UX tranche.

Physical Samsung S22+ review is the next verification step after final merge/install.

"""
s = s.replace(marker, section + marker, 1)
p.write_text(s)
PY

pnpm exec prettier --write docs/HANDOFF_NEXT_CHAT.md
git diff --check
pnpm format:check
pnpm quality:repo

git add docs/HANDOFF_NEXT_CHAT.md
git diff --cached --check
git commit -m 'docs: record navigation UX tranche'
git push origin "$BRANCH"

echo NAVIGATION_UX_DOCS_SHA=$(git rev-parse HEAD)
echo NAVIGATION_UX_DOCS_OK=1
