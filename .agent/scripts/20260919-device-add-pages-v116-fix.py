from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx')
text = path.read_text(encoding='utf-8')
old = """          <AutomationDashboardScreen
            onAddPlug={vi.fn()}
            onAddAutomation={vi.fn()}
            onOpenInstallation={vi.fn()}
          />"""
new = """          <AutomationDashboardScreen
            onAddPlug={vi.fn()}
            onAddThermometer={vi.fn()}
            onAddAutomation={vi.fn()}
            onOpenInstallation={vi.fn()}
          />"""
if old not in text:
    raise SystemExit('AutomationDashboardScreen test call not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Dashboard controls test updated')
