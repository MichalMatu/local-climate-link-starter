from pathlib import Path
import re

# Remove the legacy global floating settings trigger CSS entirely.
p = Path('apps/mobile/src/app/appShell.css')
p.write_text('.app-shell {\n  position: relative;\n}\n')

# Make the Android listener cleanup assertion resilient to effect lifecycle churn.
p = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
s = p.read_text()
old = "    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalledTimes(1));"
new = "    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalled());"
if s.count(old) != 1:
    raise SystemExit(f'Android cleanup assertion mismatch: {s.count(old)}')
s = s.replace(old, new, 1)
p.write_text(s)

# Update responsive E2E from setup-first UX to dashboard-first/+ flow.
p = Path('apps/mobile/e2e/responsive.spec.ts')
s = p.read_text()
patterns = {
    'Sterować według czasu': 2,
    'Sterować temperaturą': 1,
    'Sterować wilgotnością': 1,
}
for label, expected in patterns.items():
    regex = re.compile(
        rf"(?m)^(?P<indent>\s*)await page\.getByRole\('button', \{{ name: /{re.escape(label)}/ \}}\)\.click\(\);$"
    )
    matches = list(regex.finditer(s))
    if len(matches) != expected:
        raise SystemExit(f'{label} direct-selection count mismatch: {len(matches)} != {expected}')
    def replace(match):
        indent = match.group('indent')
        original = match.group(0).lstrip()
        return (
            f"{indent}await page.getByRole('button', {{ name: 'Dodaj automatykę' }}).click();\n"
            f"{indent}{original}"
        )
    s = regex.sub(replace, s)

old = """  await expect(page.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  await expect(page.getByText('Nie masz jeszcze zapisanej automatyki')).toHaveCount(0);"""
new = """  await expect(page.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dodaj automatykę' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Czas', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );"""
if s.count(old) != 1:
    raise SystemExit(f'delete-to-empty-dashboard marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

old = """    await expect(page).toHaveTitle('Local Climate Link');
    await expect(page.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    await expectNoHorizontalOverflow(page);"""
new = """    await expect(page).toHaveTitle('Local Climate Link');
    await expect(page.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dodaj automatykę' })).toBeVisible();
    await expectNoHorizontalOverflow(page);"""
if s.count(old) != 1:
    raise SystemExit(f'hardware dashboard-root marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

old = """    await expect(page.getByRole('heading', { name: 'Harmonogram' })).toBeVisible();
    await expect(page.getByText('Natywny Shelly Schedule')).toBeVisible();"""
new = """    await expect(page.getByRole('heading', { name: 'Harmonogram' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Czas', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.getByRole('button', { name: 'Ustawienia', exact: true })).toBeVisible();
    await expect(page.getByText('Natywny Shelly Schedule')).toBeVisible();"""
if s.count(old) != 1:
    raise SystemExit(f'time-detail bottom-nav marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

old = """    await expect(
      page.getByRole('navigation', { name: 'Menu konfiguracji' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Shelly', exact: true })
    ).toHaveAttribute('aria-current', 'page');"""
new = """    await expect(
      page.getByRole('navigation', { name: 'Menu konfiguracji' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ustawienia', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Shelly', exact: true })
    ).toHaveAttribute('aria-current', 'page');"""
if s.count(old) != 1:
    raise SystemExit(f'hardware bottom-nav assertion marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

old = "  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toBeVisible();"
new = "  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toHaveCount(0);"
if s.count(old) != 1:
    raise SystemExit(f'time-detail legacy-back marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

p.write_text(s)
