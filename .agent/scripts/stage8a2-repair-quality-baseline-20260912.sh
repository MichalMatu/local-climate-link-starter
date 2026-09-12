#!/usr/bin/env bash
set -euo pipefail

BRANCH='work/ux-polish-20260911'
BASE='ac1d2c900467be4330a09567f286a6c364072c9a'

git fetch --prune origin "$BRANCH" agent-control
git reset --hard
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/e2e/responsive.spec.ts')
s=p.read_text()

old="""const expectRelayActionVisible = async (page: Page) => {
  const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');
  const relayAction = shellyControls.getByRole('button', { name: /^(ON|OFF)$/ });
  await expect(relayAction).toHaveCount(1);
  await expect(relayAction).toBeVisible();
};
"""
new="""const expectShellyRuntimeControlsLayout = async (page: Page) => {
  const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');
  const auto = shellyControls.getByRole('button', { name: 'AUTO', exact: true });
  const manual = shellyControls.getByRole('button', { name: 'MANUAL', exact: true });
  const info = shellyControls.getByRole('button', { name: 'Ustawienia gniazdka' });
  const relayOn = shellyControls.getByRole('button', { name: 'ON', exact: true });
  const relayOff = shellyControls.getByRole('button', { name: 'OFF', exact: true });

  for (const control of [auto, manual, info, relayOn, relayOff]) {
    await expect(control).toHaveCount(1);
    await expect(control).toBeVisible();
  }

  const modeBoxes = await Promise.all([requiredBox(auto), requiredBox(manual), requiredBox(info)]);
  const relayBoxes = await Promise.all([requiredBox(relayOn), requiredBox(relayOff)]);
  const modeSpread =
    Math.max(...modeBoxes.map((box) => box.y)) - Math.min(...modeBoxes.map((box) => box.y));
  const relaySpread =
    Math.max(...relayBoxes.map((box) => box.y)) - Math.min(...relayBoxes.map((box) => box.y));
  expect(modeSpread).toBeLessThan(3);
  expect(relaySpread).toBeLessThan(3);
  expect(relayBoxes[0].y).toBeGreaterThan(modeBoxes[0].y);
};
"""
assert old in s
s=s.replace(old,new)

old="""const expectShellyCardActionsLayout = async (page: Page) => {
  const settingsToggle = page.getByRole('button', { name: 'Ustawienia gniazdka' });
  await expect(settingsToggle).toBeVisible();
  await settingsToggle.click();
  const settingsDialog = page.getByRole('dialog', { name: 'Ustawienia gniazdka' });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByText('Adres IP')).toBeVisible();
  await expect(settingsDialog.getByText('http://192.168.0.20/')).toBeVisible();
  await expect(settingsDialog.getByText('Firmware')).toBeVisible();
  await expect(settingsDialog.getByText('20260311-095902/1.7.5-g9979d16')).toBeVisible();
  await expect(settingsDialog.getByRole('button', { name: 'Skanuj BLE' })).toBeVisible();
  await expect(settingsDialog.getByRole('button', { name: 'Usuń' })).toBeVisible();
  await settingsDialog.getByRole('button', { name: 'Zamknij' }).click();

  const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');
  const boxes = await Promise.all([
    requiredBox(shellyControls.getByRole('button', { name: 'Odśwież' })),
    requiredBox(shellyControls.getByRole('button', { name: 'MANUAL', exact: true })),
    requiredBox(shellyControls.getByRole('button', { name: /^(ON|OFF)$/ }))
  ]);
  const topSpread =
    Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y));
  expect(topSpread).toBeLessThan(3);
};
"""
new="""const expectShellyCardActionsLayout = async (page: Page) => {
  const settingsToggle = page.getByRole('button', { name: 'Ustawienia gniazdka' });
  await expect(settingsToggle).toBeVisible();
  await settingsToggle.click();
  const settingsDialog = page.getByRole('dialog', { name: 'Shelly Plug S Gen3' });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByText('Adres IP')).toBeVisible();
  await expect(settingsDialog.getByText('http://192.168.0.20/')).toBeVisible();
  await expect(settingsDialog.getByText('Firmware')).toBeVisible();
  await expect(settingsDialog.getByText('20260311-095902/1.7.5-g9979d16')).toBeVisible();
  await settingsDialog.getByRole('button', { name: 'Zamknij' }).click();

  await expect(
    page.getByRole('button', { name: 'Skanuj termometry BLE przez to gniazdko' })
  ).toBeVisible();
  await expectShellyRuntimeControlsLayout(page);
};

const setWheelTime = async (
  page: Page,
  label: 'Włącz o' | 'Wyłącz o',
  hour: string,
  minute: string
) => {
  const timeButton = page.getByRole('button', { name: new RegExp(`^${label}:`) });
  await timeButton.click();
  const dialog = page.getByRole('dialog', { name: label });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: `HH ${hour}` }).click();
  await dialog.getByRole('button', { name: `MM ${minute}` }).click();
  await dialog.getByRole('button', { name: 'Wybierz' }).click();
  await expect(page.getByRole('button', { name: `${label}: ${hour}:${minute}` })).toBeVisible();
};
"""
assert old in s
s=s.replace(old,new)

old="""    await page.goto('/');

    await page.getByRole('button', { name: 'Dodaj automatykę' }).click();

    await page.getByRole('button', { name: /Sterować według czasu/ }).click();
    await expect(
      page.getByRole('navigation', { name: 'Menu konfiguracji' })
    ).toBeVisible();
"""
new="""    await page.goto('/');

    await page.getByRole('button', { name: 'Czas', exact: true }).click();
    await page.getByRole('button', { name: 'Dodaj automatykę' }).click();

    await expect(page.getByRole('button', { name: /Sterować według czasu/ })).toHaveCount(0);
    await expect(
      page.getByRole('navigation', { name: 'Menu konfiguracji' })
    ).toBeVisible();
"""
assert old in s
s=s.replace(old,new,1)
s=s.replace("    await expect(page.getByLabel('Włącz o')).toHaveValue('08:00');\n    await expect(page.getByLabel('Wyłącz o')).toHaveValue('20:00');",
            "    await expect(page.getByRole('button', { name: 'Włącz o: 08:00' })).toBeVisible();\n    await expect(page.getByRole('button', { name: 'Wyłącz o: 20:00' })).toBeVisible();",1)

old="""  await page.goto('/');
  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await page.getByRole('button', { name: /Sterować według czasu/ }).click();
  await page.getByRole('button', { name: 'Harmonogram', exact: true }).click();
"""
new="""  await page.goto('/');
  await page.getByRole('button', { name: 'Czas', exact: true }).click();
  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await expect(page.getByRole('button', { name: /Sterować według czasu/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Harmonogram', exact: true }).click();
"""
assert old in s
s=s.replace(old,new,1)
old="""  await page.getByLabel('Włącz o').fill('06:30');
  await page.getByLabel('Wyłącz o').fill('22:15');
"""
new="""  await setWheelTime(page, 'Włącz o', '06', '30');
  await setWheelTime(page, 'Wyłącz o', '22', '15');
"""
assert old in s
s=s.replace(old,new,1)

s=s.replace('    await expectRelayActionVisible(page);','    await expectShellyRuntimeControlsLayout(page);',1)
old="""    await expect(shellyControls.getByRole('button', { name: 'Odśwież' })).toBeVisible();
"""
new="""    await expect(shellyControls.getByRole('button', { name: 'Odśwież' })).toHaveCount(0);
"""
assert old in s
s=s.replace(old,new,1)

old="""  await expect(page.getByText(/Nawilżanie włączy się poniżej 45\\.0%/)).toBeVisible();
  await page.getByRole('button', { name: 'Podgląd Shelly Script' }).click();
"""
new="""  await page.getByRole('button', { name: 'Podsumowanie reguły' }).click();
  let summaryDialog = page.getByRole('dialog', { name: 'Podsumowanie reguły' });
  await expect(summaryDialog.getByText(/Nawilżanie włączy się poniżej 45\\.0%/)).toBeVisible();
  await summaryDialog.getByRole('button', { name: 'Zamknij' }).click();
  await page.getByRole('button', { name: 'Podgląd Shelly Script' }).click();
"""
assert old in s
s=s.replace(old,new,1)
old="""  await expect(page.getByText(/Osuszanie włączy się powyżej 65\\.0%/)).toBeVisible();
  await page.getByRole('button', { name: 'Podgląd Shelly Script' }).click();
"""
new="""  await page.getByRole('button', { name: 'Podsumowanie reguły' }).click();
  summaryDialog = page.getByRole('dialog', { name: 'Podsumowanie reguły' });
  await expect(summaryDialog.getByText(/Osuszanie włączy się powyżej 65\\.0%/)).toBeVisible();
  await summaryDialog.getByRole('button', { name: 'Zamknij' }).click();
  await page.getByRole('button', { name: 'Podgląd Shelly Script' }).click();
"""
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

echo STAGE8A2_SHA=$(git rev-parse HEAD)
echo STAGE8A2_PARENT=$(git rev-parse HEAD^)
echo STAGE8A2_CHECK_FULL=1
test -z "$(git status --porcelain)"
