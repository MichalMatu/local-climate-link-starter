from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text(encoding='utf-8')
old = """    const scannedRow = scannedName.closest('.shelly-scan-result__row');\n    expect(scannedRow).not.toBeNull();\n    expect(within(scannedRow!).getAllByRole('textbox')).toHaveLength(1);\n    expect(within(scannedRow!).getByText('http://192.168.0.20/')).toBeVisible();\n    expect(within(scannedRow!).getByText('S3PL-00112EU, gen 3')).toBeVisible();"""
new = """    const scannedRow = scannedName.closest('.shelly-scan-result__row') as HTMLElement | null;\n    expect(scannedRow).not.toBeNull();\n    expect(within(scannedRow!).getAllByRole('textbox')).toHaveLength(1);\n    expect(within(scannedRow!).getByText('http://192.168.0.20/')).toBeVisible();\n    expect(within(scannedRow!).getByText('S3PL-00112EU, gen 3')).toBeVisible();"""
if old not in text:
    raise SystemExit('scannedRow test block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Fixed scanned Shelly row HTMLElement typing')
