from pathlib import Path

p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = p.read_text()

old = "screen.findByText('21.3°C')"
count = text.count(old)
if count != 3:
    raise SystemExit(f'expected 3 async saved-card 21.3°C assertions, found {count}')
text = text.replace(old, "screen.findByText(/^21\\.3 °C · 45\\.7 % · 1\\.38 kPa$/)")

old = "screen.getByText('21.3°C')"
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected 1 sync saved-card 21.3°C assertion, found {count}')
text = text.replace(old, "screen.getByText(/^21\\.3 °C · 45\\.7 % · 1\\.38 kPa$/)")

old_line = "    expect(screen.getByText('45.7%')).toBeInTheDocument();\n"
count = text.count(old_line)
if count != 2:
    raise SystemExit(f'expected 2 legacy standalone humidity assertions, found {count}')
text = text.replace(old_line, '')

old = "screen.getByText('31.2°C')"
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected 1 saved-card 31.2°C assertion, found {count}')
text = text.replace(old, "screen.getByText(/^31\\.2 °C ·/)")

p.write_text(text)

presentation = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx')
text = presentation.read_text()
unused = '  const usingShellyRuntime = runtimeReading !== null;\n'
if text.count(unused) != 1:
    raise SystemExit(f'expected one unused runtime marker, found {text.count(unused)}')
presentation.write_text(text.replace(unused, '', 1))

print('Updated thermometer UI tests for compact live-value contract')
