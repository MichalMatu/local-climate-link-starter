from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx')
text = path.read_text()
old = """            onAddAutomation={vi.fn()}
            onOpenInstallation={vi.fn()}
"""
new = """            onAddAutomation={vi.fn()}
            onOpenInstallation={vi.fn()}
            onOpenPlugSettings={vi.fn()}
"""
if old not in text:
    raise SystemExit('dashboard controls render props not found')
path.write_text(text.replace(old, new, 1))
print('Dashboard controls test harness updated')
