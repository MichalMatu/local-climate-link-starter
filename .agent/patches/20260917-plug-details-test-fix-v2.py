from pathlib import Path
p = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
text = p.read_text()
old = "expect(within(settingsDialog).getByText('KOMPATYBILNE')).toBeVisible();"
new = "expect(within(settingsDialog).getByText('zgodne')).toBeVisible();"
if old not in text:
    raise SystemExit('compatibility test anchor missing')
p.write_text(text.replace(old, new, 1))
