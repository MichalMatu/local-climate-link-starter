from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()

old = '''    const bleScanControl = within(page).getByRole('button', {\n      name: /Zatrzymaj skan|Skanuj BLE ponownie/\n    });\n    expect(bleScanControl).toHaveClass('device-scan-action');'''
new = '''    const bleScanControl = within(page).getByRole('button', { name: 'Stop skanu' });\n    expect(bleScanControl).toHaveClass('device-scan-action');\n    expect(bleScanControl).toHaveAttribute('aria-busy', 'true');\n    expect(bleScanControl.querySelector('.device-scan-action__spinner')).not.toBeNull();'''
if old not in text:
    raise SystemExit('BLE scan control assertion block not found')
text = text.replace(old, new, 1)

old = '''    const stopButton = await within(dialog).findByRole('button', { name: 'Stop skanu' });\n    fireEvent.click(stopButton);'''
new = '''    const stopButton = await within(dialog).findByRole('button', { name: 'Stop skanu' });\n    expect(stopButton).toHaveClass('device-scan-action');\n    expect(stopButton).toHaveAttribute('aria-busy', 'true');\n    expect(stopButton.querySelector('.device-scan-action__spinner')).not.toBeNull();\n    fireEvent.click(stopButton);'''
if old not in text:
    raise SystemExit('Shelly active scan control block not found')
text = text.replace(old, new, 1)

path.write_text(text)
print('Covered active BLE and Shelly scan spinner states')
