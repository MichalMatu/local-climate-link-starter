from pathlib import Path
path = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
text = path.read_text().replace("getByRole('heading', { name: 'Shelly' })", "getByRole('heading', { name: 'Telemetria Shelly' })")
path.write_text(text)
print('Fixed Shelly detail heading assertion')
