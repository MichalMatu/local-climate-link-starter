from pathlib import Path

page = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = page.read_text()
old = '''            <div className="field-row">\n              <label\n                className={showShellyScanRangeError ? 'field field--invalid' : 'field'}\n'''
new = '''            <div className="field-row shelly-network-scan__range">\n              <label\n                className={showShellyScanRangeError ? 'field field--invalid' : 'field'}\n'''
if s.count(old) != 1:
    raise SystemExit(f'expected scanner range row once, got {s.count(old)}')
page.write_text(s.replace(old, new, 1))

css = Path('apps/mobile/src/theme/theme.css')
c = css.read_text()
needle = '''.shelly-network-scan__presets {\n  align-items: center;\n  display: inline-flex;\n  gap: var(--lcl-spacing-sm);\n  justify-self: center;\n  min-width: 0;\n}\n'''
replacement = needle + '''\n.shelly-network-scan__range {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n'''
if c.count(needle) != 1:
    raise SystemExit(f'expected presets css once, got {c.count(needle)}')
css.write_text(c.replace(needle, replacement, 1))

test = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
t = test.read_text()
needle_t = '''    expect(within(dialog).getByLabelText('Od')).toHaveValue('192.168.0.1');\n    expect(within(dialog).getByLabelText('Do')).toHaveValue('192.168.0.254');\n\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));\n'''
replacement_t = '''    expect(within(dialog).getByLabelText('Od')).toHaveValue('192.168.0.1');\n    expect(within(dialog).getByLabelText('Do')).toHaveValue('192.168.0.254');\n    const scanRangeRow = within(dialog).getByLabelText('Od').closest('.field-row');\n    expect(scanRangeRow).toHaveClass('shelly-network-scan__range');\n    expect(scanRangeRow?.children).toHaveLength(2);\n\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));\n'''
if t.count(needle_t) != 1:
    raise SystemExit(f'expected scanner range test anchor once, got {t.count(needle_t)}')
test.write_text(t.replace(needle_t, replacement_t, 1))
