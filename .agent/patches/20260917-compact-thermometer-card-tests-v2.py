from pathlib import Path

p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = p.read_text()
old = """    expect(within(sensorCard).getByText('MAC')).toBeInTheDocument();\n    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();\n    expect(within(sensorCard).getByText('BTHome v2')).toBeInTheDocument();\n    expect(within(sensorCard).getByText('Bateria')).toBeInTheDocument();\n    expect(within(sensorCard).getByText('RSSI')).toBeInTheDocument();\n"""
new = """    const details = within(sensorCard).getByText('Szczegóły', { selector: 'summary' });\n    expect(details.closest('details')).not.toHaveAttribute('open');\n    expect(within(sensorCard).queryByText('MAC')).not.toBeVisible();\n    expect(within(sensorCard).queryByText('BTHome v2')).not.toBeVisible();\n    expect(within(sensorCard).getByLabelText(/^Bateria:/)).toBeVisible();\n    expect(within(sensorCard).getByLabelText(/^RSSI:/)).toBeVisible();\n    expect(within(sensorCard).getByLabelText(/^Ostatni pomiar:/)).toBeVisible();\n    expect(sensorCard.querySelectorAll('.sensor-status-strip svg.tabler-icon')).toHaveLength(3);\n    expect(sensorCard.querySelectorAll('.sensor-status-strip svg:not(.tabler-icon)')).toHaveLength(0);\n    fireEvent.click(details);\n    expect(within(sensorCard).getByText('MAC')).toBeVisible();\n    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeVisible();\n    expect(within(sensorCard).getByText('BTHome v2')).toBeVisible();\n"""
if old not in text:
    raise SystemExit('test anchor missing')
p.write_text(text.replace(old, new, 1))
