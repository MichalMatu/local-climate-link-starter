#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='ac1d2c900467be4330a09567f286a6c364072c9a'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

# Reuse the already-reviewed Stage 8A2 transformations, but stop before its failing check/commit.
git show origin/agent-control:.agent/scripts/stage8a2-repair-quality-baseline-20260912.sh \
  | sed '/^pnpm check:full$/,$d' > /tmp/lcl-stage8a2-transform-only.sh
bash /tmp/lcl-stage8a2-transform-only.sh

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/e2e/responsive.spec.ts')
s=p.read_text()

# Setup uses the custom wheel picker, but installed-automation detail still intentionally uses native time inputs.
old="""  await setWheelTime(page, 'Włącz o', '06', '30');
  await setWheelTime(page, 'Wyłącz o', '22', '15');
"""
new="""  await page.getByLabel('Włącz o').fill('06:30');
  await page.getByLabel('Wyłącz o').fill('22:15');
"""
assert old in s
s=s.replace(old,new,1)

# The info modal contains the address both as description and as a link; assert the semantic link.
old="""  await expect(settingsDialog.getByText('http://192.168.0.20/')).toBeVisible();
"""
new="""  await expect(
    settingsDialog.getByRole('link', {
      name: 'Otwórz panel Shelly: http://192.168.0.20/'
    })
  ).toBeVisible();
"""
assert old in s
s=s.replace(old,new,1)

# Advanced-rule summary is intentionally behind the info modal after UX polish.
old="""  await advancedDialog.getByRole('button', { name: 'Zastosuj' }).click();
  await expect(page.getByText(/VPD assist uwzględni cel 1\\.25 kPa/)).toBeVisible();
  await expect(page.getByText(/Ponowne ON najwcześniej po 3 min/)).toBeVisible();
  await expect(
    page.getByText(/Sygnał termometru musi mieć co najmniej -80 dBm/)
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
"""
new="""  await advancedDialog.getByRole('button', { name: 'Zastosuj' }).click();
  await page.getByRole('button', { name: 'Podsumowanie reguły' }).click();
  summaryDialog = page.getByRole('dialog', { name: 'Podsumowanie reguły' });
  await expect(summaryDialog.getByText(/VPD assist uwzględni cel 1\\.25 kPa/)).toBeVisible();
  await expect(summaryDialog.getByText(/Ponowne ON najwcześniej po 3 min/)).toBeVisible();
  await expect(
    summaryDialog.getByText(/Sygnał termometru musi mieć co najmniej -80 dBm/)
  ).toBeVisible();
  await summaryDialog.getByRole('button', { name: 'Zamknij' }).click();

  await expectNoHorizontalOverflow(page);
"""
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/e2e/responsive.spec.ts README.md
pnpm check:full

git diff --check
git status --short

git add apps/mobile/e2e/responsive.spec.ts README.md
git commit -m 'Repair quality baseline after UX changes'
git push origin HEAD:"$BRANCH"

echo STAGE8A3_SHA=$(git rev-parse HEAD)
echo STAGE8A3_PARENT=$(git rev-parse HEAD^)
echo STAGE8A3_CHECK_FULL=1
test -z "$(git status --porcelain)"
