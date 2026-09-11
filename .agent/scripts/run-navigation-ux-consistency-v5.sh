#!/usr/bin/env sh
set -eu

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/run-navigation-ux-consistency-v1.sh > /tmp/run-navigation-ux-consistency-v5-inner.sh

cat > /tmp/navigation-ux-v5-patch.py <<'PY'
from pathlib import Path
import re

p = Path('apps/mobile/src/app/appShell.css')
p.write_text(".app-shell {\n  position: relative;\n}\n")

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
  await expect(page.getByRole('button', { name: 'Czas' })).toHaveAttribute(
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
    await expect(page.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.getByRole('button', { name: 'Ustawienia' })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Ustawienia' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Shelly', exact: true })
    ).toHaveAttribute('aria-current', 'page');"""
if s.count(old) != 1:
    raise SystemExit(f'hardware bottom-nav assertion marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/run-navigation-ux-consistency-v5-inner.sh')
s = p.read_text()
old = "    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalledTimes(1));"
new = "    await waitFor(() => expect(nativeAppMocks.removeListener).toHaveBeenCalled());"
if s.count(old) != 1:
    raise SystemExit(f'Android cleanup assertion mismatch: {s.count(old)}')
s = s.replace(old, new, 1)
marker = "pnpm exec prettier --write \\\n  apps/mobile/src/routes/AppRoutes.tsx"
if s.count(marker) != 1:
    raise SystemExit(f'prettier marker mismatch: {s.count(marker)}')
insertion = "python3 /tmp/navigation-ux-v5-patch.py\npnpm exec prettier --write apps/mobile/src/app/appShell.css apps/mobile/e2e/responsive.spec.ts\n\n"
s = s.replace(marker, insertion + marker, 1)
old_guard = "git grep -n 'app-settings-trigger' -- apps/mobile/src || true"
new_guard = "if git grep -n 'app-settings-trigger' -- apps/mobile/src ':!apps/mobile/src/__tests__/*'; then\n  echo 'legacy app settings trigger remains in product code' >&2\n  exit 42\nfi"
if s.count(old_guard) != 1:
    raise SystemExit(f'app-settings trigger guard mismatch: {s.count(old_guard)}')
s = s.replace(old_guard, new_guard, 1)
p.write_text(s)
PY

sh /tmp/run-navigation-ux-consistency-v5-inner.sh
