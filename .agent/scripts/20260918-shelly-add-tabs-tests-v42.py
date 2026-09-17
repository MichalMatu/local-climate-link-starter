from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = path.read_text()

s = replace_once(
    s,
    """    const shellyScanSummary = within(shellyAddDialog).getByText('Skanuj sieć', {\n      selector: 'summary'\n    });\n    expect(shellyScanSummary).toBeVisible();\n    expect(shellyScanSummary.closest('details')).not.toHaveAttribute('open');\n""",
    """    const shellyScanTab = within(shellyAddDialog).getByRole('tab', {\n      name: 'Skanuj sieć'\n    });\n    const shellyManualTab = within(shellyAddDialog).getByRole('tab', {\n      name: 'Dodaj ręcznie'\n    });\n    expect(shellyScanTab).toBeVisible();\n    expect(shellyScanTab).toHaveAttribute('aria-selected', 'false');\n    expect(shellyManualTab).toHaveAttribute('aria-selected', 'true');\n    expect(\n      within(shellyAddDialog).getByRole('tabpanel', { name: 'Dodaj ręcznie' })\n    ).toBeInTheDocument();\n    expect(\n      within(shellyAddDialog).queryByRole('tabpanel', { name: 'Skanuj sieć' })\n    ).not.toBeInTheDocument();\n""",
    'logical pages tab assertions'
)

s = replace_once(
    s,
    """    expect(within(dialog).getByLabelText('Adres IP Shelly')).not.toHaveValue(\n      'http://192.168.0.20/'\n    );\n""",
    """    fireEvent.click(within(dialog).getByRole('tab', { name: 'Dodaj ręcznie' }));\n    expect(within(dialog).getByLabelText('Adres IP Shelly')).not.toHaveValue(\n      'http://192.168.0.20/'\n    );\n""",
    'direct scan add manual form assertion'
)

old_discovered = """  it('uses the discovered model as the default scanner name without populating the manual form', async () => {\n    renderHardwareSetup();\n\n    const dialog = await openShellyAddDialog('scan');\n    const manualName = within(dialog).getByRole('textbox', { name: /^Nazwa gniazdka$/ });\n    const manualAddress = within(dialog).getByLabelText('Adres IP Shelly');\n    const initialManualName = (manualName as HTMLInputElement).value;\n    const initialManualAddress = (manualAddress as HTMLInputElement).value;\n\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));\n    await within(dialog).findByText('http://192.168.0.20/');\n"""
new_discovered = """  it('uses the discovered model as the default scanner name without populating the manual form', async () => {\n    renderHardwareSetup();\n\n    const dialog = await openShellyAddDialog('scan');\n    const manualTab = within(dialog).getByRole('tab', { name: 'Dodaj ręcznie' });\n    const scanTab = within(dialog).getByRole('tab', { name: 'Skanuj sieć' });\n    fireEvent.click(manualTab);\n    const manualName = within(dialog).getByRole('textbox', { name: /^Nazwa gniazdka$/ });\n    const manualAddress = within(dialog).getByLabelText('Adres IP Shelly');\n    const initialManualName = (manualName as HTMLInputElement).value;\n    const initialManualAddress = (manualAddress as HTMLInputElement).value;\n    fireEvent.click(scanTab);\n\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Rozpocznij skan' }));\n    await within(dialog).findByText('http://192.168.0.20/');\n"""
s = replace_once(s, old_discovered, new_discovered, 'discovered model setup')

s = replace_once(
    s,
    """    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();\n    expect(within(dialog).getByRole('textbox', { name: /^Nazwa gniazdka$/ })).toHaveValue(\n      initialManualName\n    );\n""",
    """    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();\n    fireEvent.click(within(dialog).getByRole('tab', { name: 'Dodaj ręcznie' }));\n    expect(within(dialog).getByRole('textbox', { name: /^Nazwa gniazdka$/ })).toHaveValue(\n      initialManualName\n    );\n""",
    'discovered model manual verification'
)

for test_name in [
    'stops an active Shelly scan from the inline task control',
    'stops an active Shelly scan when closing the add task'
]:
    start = s.index(f"  it('{test_name}'")
    end = s.find("\n  it('", start + 6)
    if end == -1:
        end = len(s)
    block = s[start:end]
    if 'openShellyAddDialog()' not in block:
        raise SystemExit(f'{test_name}: expected openShellyAddDialog()')
    block = block.replace('openShellyAddDialog()', "openShellyAddDialog('scan')", 1)
    s = s[:start] + block + s[end:]

path.write_text(s)
