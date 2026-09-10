from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
text = path.read_text()
old = "    const { onNavigateDashboard, onOpenSettings } = renderDetail(saved.id);"
new = "    const { onBack, onNavigateDashboard, onOpenSettings } = renderDetail(saved.id);"
if text.count(old) != 1:
    raise SystemExit(f'unexpected renderDetail destructuring count: {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('climate detail nav test binding fixed')
