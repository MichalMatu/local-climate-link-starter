from pathlib import Path

root = Path('.')

detail = root / 'apps/mobile/src/screens/InstallationDetailScreen.tsx'
text = detail.read_text()
replacements = {
    "onOpenClimate={() => onNavigateDashboard?.('climate') ?? onBack()}":
        "onOpenClimate={() =>\n          onNavigateDashboard ? onNavigateDashboard('climate') : onBack()\n        }",
    "onOpenTime={() => onNavigateDashboard?.('time') ?? onBack()}":
        "onOpenTime={() =>\n          onNavigateDashboard ? onNavigateDashboard('time') : onBack()\n        }",
}
for old, new in replacements.items():
    if text.count(old) != 1:
        raise SystemExit(f'unexpected detail nav fallback anchor count for {old!r}: {text.count(old)}')
    text = text.replace(old, new, 1)
detail.write_text(text)

test = root / 'apps/mobile/src/__tests__/automation-detail.test.tsx'
text = test.read_text()
old = """    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    expect(onNavigateDashboard).toHaveBeenCalledWith('time');
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));"""
new = """    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    expect(onNavigateDashboard).toHaveBeenCalledWith('time');
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia' }));"""
if text.count(old) != 1:
    raise SystemExit(f'unexpected automation-detail nav test anchor count: {text.count(old)}')
text = text.replace(old, new, 1)
test.write_text(text)

print('climate detail nav fallback fix applied')
