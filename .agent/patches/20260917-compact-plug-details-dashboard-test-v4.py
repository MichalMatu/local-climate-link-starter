from pathlib import Path

p = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
text = p.read_text()
old = "    expect(settingsDialog.querySelector('.lcl-compact-device')).not.toBeNull();\n"
new = "    expect(settingsDialog.querySelector('.status-stack')).not.toBeNull();\n"
if old not in text:
    raise SystemExit('old compact device assertion missing')
p.write_text(text.replace(old, new, 1))
