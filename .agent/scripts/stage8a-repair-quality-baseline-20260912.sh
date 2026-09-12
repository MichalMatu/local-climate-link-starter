#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='ac1d2c900467be4330a09567f286a6c364072c9a'

git fetch --prune origin "$BRANCH" agent-control
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path

p=Path('apps/mobile/e2e/responsive.spec.ts')
s=p.read_text()
old="""const expectRelayActionVisible = async (page: Page) => {\n  const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');\n  const relayAction = shellyControls.getByRole('button', { name: /^(ON|OFF)$/ });\n  await expect(relayAction).toHaveCount(1);\n  await expect(relayAction).toBeVisible();\n};\n"""
new="""const expectRelayActionsVisible = async (page: Page) => {\n  const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');\n  const relayOn = shellyControls.getByRole('button', { name: 'ON', exact: true });\n  const relayOff = shellyControls.getByRole('button', { name: 'OFF', exact: true });\n  await expect(relayOn).toHaveCount(1);\n  await expect(relayOff).toHaveCount(1);\n  await expect(relayOn).toBeVisible();\n  await expect(relayOff).toBeVisible();\n};\n"""
assert old in s
s=s.replace(old,new)
s=s.replace('await expectRelayActionVisible(page);','await expectRelayActionsVisible(page);')

old="""    await page.goto('/');\n\n    await page.getByRole('button', { name: 'Dodaj automatykę' }).click();\n\n    await page.getByRole('button', { name: /Sterować według czasu/ }).click();\n    await expect(\n      page.getByRole('navigation', { name: 'Menu konfiguracji' })\n    ).toBeVisible();\n"""
new="""    await page.goto('/');\n\n    await page.getByRole('button', { name: 'Czas', exact: true }).click();\n    await page.getByRole('button', { name: 'Dodaj automatykę' }).click();\n\n    await expect(page.getByRole('button', { name: /Sterować według czasu/ })).toHaveCount(0);\n    await expect(\n      page.getByRole('navigation', { name: 'Menu konfiguracji' })\n    ).toBeVisible();\n"""
assert old in s
s=s.replace(old,new,1)

old="""  await page.goto('/');\n  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();\n  await page.getByRole('button', { name: /Sterować według czasu/ }).click();\n  await page.getByRole('button', { name: 'Harmonogram', exact: true }).click();\n"""
new="""  await page.goto('/');\n  await page.getByRole('button', { name: 'Czas', exact: true }).click();\n  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();\n  await expect(page.getByRole('button', { name: /Sterować według czasu/ })).toHaveCount(0);\n  await page.getByRole('button', { name: 'Harmonogram', exact: true }).click();\n"""
assert old in s
s=s.replace(old,new,1)

old="""    await expect(shellyControls.getByRole('button', { name: 'Odśwież' })).toBeVisible();\n"""
new="""    await expect(shellyControls.getByRole('button', { name: 'Odśwież' })).toHaveCount(0);\n"""
assert old in s
s=s.replace(old,new,1)

old="""  await expect(page.getByText(/Nawilżanie włączy się poniżej 45\\.0%/)).toBeVisible();\n  await page.getByRole('button', { name: 'Podgląd Shelly Script' }).click();\n"""
new="""  await page.getByRole('button', { name: 'Podsumowanie reguły' }).click();\n  const summaryDialog = page.getByRole('dialog', { name: 'Podsumowanie reguły' });\n  await expect(summaryDialog.getByText(/Nawilżanie włączy się poniżej 45\\.0%/)).toBeVisible();\n  await summaryDialog.getByRole('button', { name: 'Zamknij' }).click();\n  await page.getByRole('button', { name: 'Podgląd Shelly Script' }).click();\n"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

p=Path('README.md')
s=p.read_text()
assert 'Direct assets for the current published release (v2.0.8):' in s
s=s.replace('Direct assets for the current published release (v2.0.8):','Direct assets for the current published release (v2.0.10):')
s=s.replace('Android APK v2.0.8](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.8/local-climate-link-v2.0.8-android-release.apk)','Android APK v2.0.10](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.10/local-climate-link-v2.0.10-android-release.apk)')
s=s.replace('Android App Bundle v2.0.8](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.8/local-climate-link-v2.0.8-android-release.aab)','Android App Bundle v2.0.10](https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.10/local-climate-link-v2.0.10-android-release.aab)')
s=s.replace('https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.8/local-climate-link-v2.0.8-sha256.txt','https://github.com/MichalMatu/local-climate-link-starter/releases/download/v2.0.10/local-climate-link-v2.0.10-sha256.txt')
p.write_text(s)
PY

pnpm exec prettier --write apps/mobile/e2e/responsive.spec.ts README.md
pnpm check:full

git diff --check
git status --short

git add apps/mobile/e2e/responsive.spec.ts README.md
git commit -m 'Repair quality baseline after UX changes'
git push origin HEAD:"$BRANCH"

echo STAGE8A_SHA=$(git rev-parse HEAD)
echo STAGE8A_PARENT=$(git rev-parse HEAD^)
echo STAGE8A_CHECK_FULL=1
test -z "$(git status --porcelain)"
