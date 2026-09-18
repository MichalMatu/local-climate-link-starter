from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
test_text = test_path.read_text()
old_test = """    openRuleDisclosure('Zaawansowane');
    expect(
      screen.getByRole('button', { name: 'Otwórz opcje zaawansowane' })
    ).toHaveAttribute('title', 'Zmień VPD, przekaźnik, RSSI i limity bezpieczeństwa');
"""
new_test = """    const advancedSection = openRuleDisclosure('Zaawansowane');
    expect(within(advancedSection).getByLabelText('Ponowne ON po min')).toBeInTheDocument();
    expect(
      within(advancedSection).getByRole('button', { name: 'Domyślne' })
    ).toHaveClass('rule-advanced-defaults-link');
    expect(
      screen.queryByRole('dialog', { name: 'Opcje zaawansowane' })
    ).not.toBeInTheDocument();
"""
test_text = replace_once(test_text, old_test, new_test, 'legacy advanced button assertion')

negative_open_button = re.compile(
    r"\n\s*expect\(\s*within\(advancedSection\)\.queryByRole\('button',\s*\{\s*name:\s*'Otwórz opcje zaawansowane'\s*\}\)\s*\)\.not\.toBeInTheDocument\(\);",
    re.MULTILINE,
)
test_text, removed = negative_open_button.subn('', test_text)
if removed not in (0, 1):
    raise SystemExit(f'unexpected legacy negative assertion count: {removed}')
if "openRuleAdvancedDialog" in test_text:
    raise SystemExit('legacy advanced dialog helper remains in hardware setup tests')
test_path.write_text(test_text)


e2e_path = Path('apps/mobile/e2e/responsive.spec.ts')
e2e_text = e2e_path.read_text()

old_smoke = """    await page.locator('summary').filter({ hasText: 'Zaawansowane' }).click();
    await page.getByRole('button', { name: 'Otwórz opcje zaawansowane' }).click();
    await expect(page.getByRole('dialog', { name: 'Opcje zaawansowane' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);
    await page.getByRole('button', { name: 'Zamknij' }).click();
"""
new_smoke = """    await page.locator('summary').filter({ hasText: 'Zaawansowane' }).click();
    await expect(page.getByLabel('Ponowne ON po min')).toBeVisible();
    await expect(page.getByLabel('Maksymalny czas pracy h')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Domyślne' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Opcje zaawansowane' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);
"""
e2e_text = replace_once(e2e_text, old_smoke, new_smoke, 'responsive advanced smoke flow')

old_edit = """  await page.getByLabel('VPD assist').check();
  await page.getByLabel('Docelowe VPD kPa').fill('1.25');
  await page.locator('summary').filter({ hasText: 'Zaawansowane' }).click();
  await page.getByRole('button', { name: 'Otwórz opcje zaawansowane' }).click();
  const advancedDialog = page.getByRole('dialog', { name: 'Opcje zaawansowane' });
  await expect(advancedDialog).toBeVisible();
  await expect(advancedDialog).toBeFocused();
  await expect(advancedDialog.getByLabel('Minimalny RSSI dBm')).not.toBeFocused();
  await expect(advancedDialog.getByLabel('Minimalny RSSI dBm')).toHaveValue('-85');
  await expect(advancedDialog.getByLabel('Brak odczytu przez min')).toHaveValue('2');
  await expect(advancedDialog.getByLabel('Ponowne ON po min')).toHaveValue('2');
  await expect(advancedDialog.getByLabel('VPD assist')).toHaveCount(0);
  await advancedDialog.getByLabel('Minimalny RSSI dBm').fill('-80');
  await advancedDialog.getByLabel('Brak odczytu przez min').fill('10');
  await advancedDialog.getByLabel('Ponowne ON po min').fill('3');
  await advancedDialog.getByLabel('Maksymalny czas pracy h').fill('3');
  await advancedDialog.getByRole('button', { name: 'Zastosuj' }).click();
"""
new_edit = """  await page.getByLabel('VPD assist').check();
  await page.getByLabel('Docelowe VPD kPa').fill('1.25');
  await page.locator('summary').filter({ hasText: 'Zaawansowane' }).click();
  await expect(page.getByRole('dialog', { name: 'Opcje zaawansowane' })).toHaveCount(0);
  await expect(page.getByLabel('Minimalny RSSI dBm')).toHaveValue('-85');
  await expect(page.getByLabel('Brak odczytu przez min')).toHaveValue('2');
  await expect(page.getByLabel('Ponowne ON po min')).toHaveValue('2');
  await page.getByLabel('Minimalny RSSI dBm').fill('-80');
  await page.getByLabel('Brak odczytu przez min').fill('10');
  await page.getByLabel('Ponowne ON po min').fill('3');
  await page.getByLabel('Maksymalny czas pracy h').fill('3');
"""
e2e_text = replace_once(e2e_text, old_edit, new_edit, 'responsive advanced edit flow')

legacy_click = "getByRole('button', { name: 'Otwórz opcje zaawansowane' }).click()"
if legacy_click in e2e_text:
    raise SystemExit('legacy advanced open-button click remains in responsive E2E')
if "const advancedDialog = page.getByRole('dialog', { name: 'Opcje zaawansowane' })" in e2e_text:
    raise SystemExit('legacy advanced dialog variable remains in responsive E2E')
e2e_path.write_text(e2e_text)

print('Updated all remaining unit and responsive E2E coverage for inline Advanced UI')
