from pathlib import Path

path = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
text = path.read_text()
old = "screen.getByRole('button', { name: 'Szczegóły' })"
new = "screen.getByRole('button', { name: 'Szczegóły: Salon' })"
count = text.count(old)
if count != 2:
    raise SystemExit(f'expected exactly 2 old details route queries, found {count}')
path.write_text(text.replace(old, new))
print('dashboard route tests updated for dots details entry')
