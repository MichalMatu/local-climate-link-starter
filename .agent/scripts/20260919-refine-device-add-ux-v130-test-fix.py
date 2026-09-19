from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text(encoding='utf-8')
old = "expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();"
count = text.count(old)
if count != 2:
    raise SystemExit(f'expected 2 remaining add-plug heading assertions, found {count}')
new = """expect(screen.getByRole('region', { name: 'Dodaj gniazdko' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();"""
path.write_text(text.replace(old, new), encoding='utf-8')
print('Aligned two remaining Shelly add-page tests with title-free standalone page UX')
