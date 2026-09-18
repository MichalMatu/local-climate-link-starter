from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
content = path.read_text()
needle = """  it('restarts saved thermometer live scan after app visibility resumes', async () => {\n"""
insert = """  it('shows compact live values on the right side of the rule thermometer options', async () => {\n    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');\n    useHardwareSetupDraftStore.setState({\n      ...DEFAULT_HARDWARE_SETUP_DRAFT,\n      sensorDevices: [\n        {\n          id: 'A4:C1:38:4F:24:CD',\n          name: 'Xiaomi salon',\n          runtimeAddress: 'A4:C1:38:4F:24:CD',\n          profileId: 'xiaomi_lywsd03mmc_bthome_v2'\n        }\n      ],\n      selectedSensorId: 'A4:C1:38:4F:24:CD'\n    });\n    renderHardwareSetup();\n\n    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));\n    await waitFor(() => expect(phoneBleScannerMock.startCount).toBeGreaterThanOrEqual(1));\n    fireEvent.click(screen.getByRole('button', { name: 'Termometr' }));\n\n    const option = await screen.findByRole('option', { name: 'Xiaomi salon' });\n    expect(option).toHaveTextContent('21.3°C · 45.7% · 1.38kPa');\n    expect(option.querySelector('.tabler-icon-device-mobile')).not.toBeNull();\n    const metadata = option.querySelector('.lcl-select-field__option-meta');\n    expect(metadata).not.toBeNull();\n    expect(metadata).toHaveTextContent('21.3°C · 45.7% · 1.38kPa');\n  });\n\n"""
if content.count(needle) != 1:
    raise SystemExit(f'expected one insertion point, got {content.count(needle)}')
path.write_text(content.replace(needle, insert + needle, 1))
print('Added rule thermometer selector live-value integration test')
