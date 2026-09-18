from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
text = path.read_text()
text = text.replace("getByText('Przyczyna')", "getByText('Powód')")
text = text.replace("getByRole('heading', { name: 'Czujnik' })", "getByRole('heading', { name: 'BLE i sensor' })")
old = "    expect(await screen.findByText('21.4°C')).toBeVisible();\n    fireEvent.click(screen.getByRole('button', { name: 'Diagnostyka' }));"
new = "    expect(await screen.findByRole('heading', { name: 'Salon' })).toBeVisible();\n    fireEvent.click(screen.getByRole('button', { name: 'Diagnostyka' }));"
if old not in text:
    raise SystemExit('technical diagnostics readiness anchor missing')
text = text.replace(old, new, 1)
path.write_text(text)
print('Fixed detail test expectations for current Polish copy')
