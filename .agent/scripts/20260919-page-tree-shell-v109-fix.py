from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
source = path.read_text()
old = """    expect(screen.getByRole('heading', { name: 'Skrypt', level: 2 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Shelly', level: 2 })).toBeVisible();
    expect(await screen.findByText('JS użyte teraz')).toBeVisible();
"""
new = """    expect(
      await screen.findByRole('heading', { name: 'Skrypt', level: 2 })
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Shelly', level: 2 })).toBeVisible();
    expect(await screen.findByText('JS użyte teraz')).toBeVisible();
"""
if old not in source:
    raise SystemExit('diagnostics async assertion anchor missing')
path.write_text(source.replace(old, new, 1))
print('Fixed diagnostics page async test')
