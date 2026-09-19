from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
marker = "  it('keeps standalone device-add pages free of duplicate top navigation and titles', () => {\n"
insert = """  it('uses the shared child-page back chrome for the setup flow', () => {\n    const onBackToIntent = vi.fn();\n    renderHardwareSetup({ setupIntent: 'temperature', onBackToIntent });\n\n    const back = screen.getByRole('button', { name: '‹ Zmień cel' });\n    expect(back.closest('.app-page-back-row')).not.toBeNull();\n    fireEvent.click(back);\n    expect(onBackToIntent).toHaveBeenCalledTimes(1);\n  });\n\n"""
if marker not in text:
    raise SystemExit('hardware setup test insertion marker not found')
path.write_text(text.replace(marker, insert + marker, 1))
print('Setup back chrome regression test patched')
