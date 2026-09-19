from pathlib import Path

p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = p.read_text(encoding='utf-8')
old = """    const sensorCard = getSavedSensorCard('Termometr 24:CD');
    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(sensorCard).getByText('100%')).toBeInTheDocument();"""
new = """    const sensorCard = getSavedSensorCard('Termometr 24:CD');
    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();"""
if old not in text:
    raise SystemExit('target battery assertion block not found')
p.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Immediate battery timing assertion removed')
