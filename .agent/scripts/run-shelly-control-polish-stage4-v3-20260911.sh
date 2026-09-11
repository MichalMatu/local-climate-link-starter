#!/usr/bin/env sh
set -eu

BASE=974a25872f05758a54437f37c931f6769793b4ea
BRANCH=work/ux-polish-20260911

git fetch origin agent-control "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"

git show origin/agent-control:.agent/scripts/run-shelly-control-polish-stage4-v2-20260911.sh > /tmp/shelly-stage4-v2.sh
set +e
sh /tmp/shelly-stage4-v2.sh
V2_RC=$?
set -e

# v2 is expected to stop at the one remaining legacy test assertion.
# If it ever succeeds, there is nothing left for this wrapper to repair.
if [ "$V2_RC" -eq 0 ]; then
  echo "STAGE4_V2_ALREADY_SUCCEEDED=1"
  exit 0
fi

test "$(git branch --show-current)" = "$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"

python3 - <<'PY'
from pathlib import Path
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()
old = """    fireEvent.click(within(actionRow).getByRole('button', { name: 'ON' }));
    await screen.findByText('Przekaźnik ON.');"""
new = """    const deleteManualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });
    if (deleteManualButton.getAttribute('aria-pressed') !== 'true') {
      fireEvent.click(deleteManualButton);
      await screen.findByText('Tryb MANUAL. Przekaźnik OFF.');
    }
    fireEvent.click(within(actionRow).getByRole('button', { name: 'ON' }));
    await screen.findByText('Przekaźnik ON.');"""
count = s.count(old)
if count != 1:
    raise SystemExit(f'delete relay legacy pattern: expected 1 match, got {count}')
s = s.replace(old, new, 1)
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm exec eslint \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx
pnpm --filter @lcl/mobile build
git diff --check

git add \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx

git diff --cached --check
git commit -m "Align Shelly runtime controls with dashboard"
git push --force-with-lease origin "$BRANCH"

echo SHELLY_STAGE4_SHA=$(git rev-parse HEAD)
