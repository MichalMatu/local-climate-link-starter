from pathlib import Path

path = Path('apps/mobile/src/screens/hardware-setup/pageContracts.ts')
text = path.read_text()
needle = "  | 'restartSavedSensorLiveScan'\n  | 'sensorDevices'"
replacement = "  | 'restartSavedSensorLiveScan'\n  | 'savedSensorLiveScanState'\n  | 'sensorDevices'"
if text.count(needle) != 1:
    raise SystemExit(f'expected exactly one SensorSetupFlow insertion point, found {text.count(needle)}')
path.write_text(text.replace(needle, replacement, 1))
print('Added savedSensorLiveScanState to SensorSetupFlow contract')
