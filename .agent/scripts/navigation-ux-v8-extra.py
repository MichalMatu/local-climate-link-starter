from pathlib import Path

p = Path('apps/mobile/e2e/responsive.spec.ts')
s = p.read_text()

old = "page.getByRole('button', { name: 'Czas' })).toHaveAttribute("
new = "page.getByRole('button', { name: 'Czas', exact: true })).toHaveAttribute("
if s.count(old) != 2:
    raise SystemExit(f'Czas selector count mismatch: {s.count(old)}')
s = s.replace(old, new)

old = "page.getByRole('button', { name: 'Ustawienia' })).toBeVisible();"
new = "page.getByRole('button', { name: 'Ustawienia', exact: true })).toBeVisible();"
if s.count(old) != 2:
    raise SystemExit(f'Ustawienia selector count mismatch: {s.count(old)}')
s = s.replace(old, new)

old = "  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toBeVisible();"
new = "  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toHaveCount(0);"
if s.count(old) != 1:
    raise SystemExit(f'time-detail legacy-back marker mismatch: {s.count(old)}')
s = s.replace(old, new, 1)

p.write_text(s)
