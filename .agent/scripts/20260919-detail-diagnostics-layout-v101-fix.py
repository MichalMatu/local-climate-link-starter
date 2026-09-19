from pathlib import Path

path = Path('apps/mobile/src/__tests__/automation-detail.test.tsx')
text = path.read_text()
text = text.replace("expect(within(sensorCard!).getByText('91%')).toBeVisible();", "expect(await within(sensorCard!).findByText('91%')).toBeVisible();")
text = text.replace("expect(within(sensorCard!).getByText('-51 dBm')).toBeVisible();", "expect(await within(sensorCard!).findByText('-51 dBm')).toBeVisible();")
text = text.replace("expect(within(shellyCard!).getByText('0.20 A')).toBeVisible();", "expect(await within(shellyCard!).findByText('0.20 A')).toBeVisible();")
text = text.replace("expect(within(shellyCard!).getByText('32.4°C')).toBeVisible();", "expect(await within(shellyCard!).findByText('32.4°C')).toBeVisible();")
text = text.replace("expect(within(dialog).getByText('Stan RPC skryptu')).toBeVisible();", "expect(within(dialog).getByText('Stan skryptu RPC')).toBeVisible();")
path.write_text(text)
print('Fixed async diagnostic assertions and RPC label')
