from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
text = path.read_text()
old = """    expect(await screen.findByText('Offline')).toBeVisible();\n    expect(screen.getByText('Brak połączenia z Shelly.')).toBeVisible();\n    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);\n"""
new = """    expect(await screen.findByText('Offline')).toBeVisible();\n    expect(screen.queryByText('Brak połączenia z Shelly.')).toBeNull();\n    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);\n"""
if old not in text:
    raise SystemExit('offline dashboard expectation marker missing')
path.write_text(text.replace(old, new, 1))
print('dashboard visual polish offline expectation fixed')
