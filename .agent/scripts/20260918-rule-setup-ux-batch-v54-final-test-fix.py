from pathlib import Path


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
    expect(
      within(advancedSection).getByLabelText('Ponowne ON po min')
    ).toBeInTheDocument();
    expect(
      within(advancedSection).getByRole('button', { name: 'Domyślne' })
    ).toHaveClass('rule-advanced-defaults-link');
    expect(
      screen.queryByRole('dialog', { name: 'Opcje zaawansowane' })
    ).not.toBeInTheDocument();
"""
test_text = replace_once(test_text, old_test, new_test, 'legacy advanced button assertion')
if "Otwórz opcje zaawansowane" in test_text:
    raise SystemExit('legacy advanced open-button text remains in hardware setup tests')
if "openRuleAdvancedDialog" in test_text:
    raise SystemExit('legacy advanced dialog helper remains in hardware setup tests')
test_path.write_text(test_text)


e2e_path = Path('apps/mobile/e2e/responsive.spec.ts')
e2e_text = e2e_path.read_text()
old_e2e = """    await page.locator('summary').filter({ hasText: 'Zaawansowane' }).click();
    await page.getByRole('button', { name: 'Otwórz opcje zaawansowane' }).click();
    await expect(page.getByRole('dialog', { name: 'Opcje zaawansowane' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
"""
new_e2e = """    await page.locator('summary').filter({ hasText: 'Zaawansowane' }).click();
    await expect(page.getByLabel('Ponowne ON po min')).toBeVisible();
    await expect(page.getByLabel('Maksymalny czas pracy h')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Domyślne' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Opcje zaawansowane' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
"""
e2e_text = replace_once(e2e_text, old_e2e, new_e2e, 'responsive advanced modal flow')
if "Otwórz opcje zaawansowane" in e2e_text:
    raise SystemExit('legacy advanced open-button text remains in responsive E2E')
e2e_path.write_text(e2e_text)

print('Updated remaining unit and responsive E2E coverage for inline Advanced UI')
