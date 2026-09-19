from pathlib import Path

ROOT = Path('.')


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:220]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')


# Keep the manual Shelly draft intact after save. Saving and navigation are separate,
# but preserving the draft remains part of the existing persistence contract.
shelly = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    shelly,
    """        pushToast('ok', t('hardware.shelly.added'));\n        if (addOnly) {\n          flow.setShellyNameInput('');\n          flow.setShellyUrlInput('');\n        }""",
    """        pushToast('ok', t('hardware.shelly.added'));""",
)


test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'

# A direct Shelly add now remains on its child page until explicit Back.
replace(
    test,
    """    expect(await screen.findByText('Salon')).toBeInTheDocument();\n    expect(\n      screen.queryByRole('dialog', { name: 'Shelly sprawdzone' })\n    ).not.toBeInTheDocument();\n    expect(screen.queryByText('http://192.168.0.20/')).not.toBeInTheDocument();\n    expect(screen.getByText('Salon')).toBeInTheDocument();\n    expect(screen.queryByText('Adres')).not.toBeInTheDocument();\n    expect(screen.queryByText('Script ID')).not.toBeInTheDocument();\n    expect(screen.queryByText('wybrane')).not.toBeInTheDocument();\n    expect(screen.queryByRole('button', { name: 'Wybierz' })).not.toBeInTheDocument();\n\n    const savedPlugList = screen.getByLabelText('Dodane gniazdka');""",
    """    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();\n    expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();\n    expect(\n      screen.queryByRole('dialog', { name: 'Shelly sprawdzone' })\n    ).not.toBeInTheDocument();\n    closeCurrentAddPage();\n    expect(screen.queryByText('http://192.168.0.20/')).not.toBeInTheDocument();\n    expect(screen.getByText('Salon')).toBeInTheDocument();\n    expect(screen.queryByText('Adres')).not.toBeInTheDocument();\n    expect(screen.queryByText('Script ID')).not.toBeInTheDocument();\n    expect(screen.queryByText('wybrane')).not.toBeInTheDocument();\n    expect(screen.queryByRole('button', { name: 'Wybierz' })).not.toBeInTheDocument();\n\n    const savedPlugList = screen.getByLabelText('Dodane gniazdka');""",
)

# Wait for the add mutation to mark a scanned Shelly as already added while the scan page stays open.
replace(
    test,
    """    expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();\n    expect(\n      within(page).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })\n    ).toBeDisabled();\n    expect(within(page).getByText('http://192.168.0.20/')).toBeInTheDocument();""",
    """    expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();\n    await waitFor(() =>\n      expect(\n        within(page).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })\n      ).toBeDisabled()\n    );\n    expect(within(page).getByText('http://192.168.0.20/')).toBeInTheDocument();""",
)

# The model-derived scan name test also explicitly leaves the child page after verifying the saved state.
replace(
    test,
    """    fireEvent.click(\n      within(page).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })\n    );\n\n    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');\n    expect(within(savedPlugList).getByText('S3PL-00112EU')).toBeInTheDocument();\n\n    page = await openShellyAddDialog('manual');""",
    """    fireEvent.click(\n      within(page).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })\n    );\n    await waitFor(() =>\n      expect(\n        within(page).getByRole('button', { name: 'Dodane: http://192.168.0.20/' })\n      ).toBeDisabled()\n    );\n    closeCurrentAddPage();\n\n    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');\n    expect(within(savedPlugList).getByText('S3PL-00112EU')).toBeInTheDocument();\n\n    page = await openShellyAddDialog('manual');""",
)

# Saving the first BLE candidate must not stop scanning; the delayed second candidate must still arrive.
replace(
    test,
    """    expect(within(page).getByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();\n    closeCurrentAddPage();""",
    """    expect(await within(page).findByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();\n    closeCurrentAddPage();""",
)

print('Page-flow test timing and Shelly draft persistence aligned')
