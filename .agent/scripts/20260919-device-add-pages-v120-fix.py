from pathlib import Path

ROOT = Path('.')

def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')

hardware = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
replace(
    hardware,
    "  const closeLocalAdd = () => setLocalAddPage(null);",
    """  const closeLocalAdd = () => {
    if (localAddPage === 'plug') flow.stopShellyScan();
    if (localAddPage === 'sensor') flow.stopPhoneBleScan();
    setLocalAddPage(null);
  };""",
)

test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace(
    test,
    """    const shellyAddBackdrop = document.querySelector('.lcl-modal-backdrop');
    expect(shellyAddBackdrop).not.toBeNull();
    fireEvent.click(shellyAddBackdrop!);
    expect(
      screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })
    ).not.toBeInTheDocument();""",
    """    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
    closeCurrentAddPage();
    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();""",
)
replace(
    test,
    """    expect(await screen.findByText('Dodano gniazdko.')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Shelly sprawdzone' })
    ).not.toBeInTheDocument();""",
    """    expect(await screen.findByText('Salon')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Shelly sprawdzone' })
    ).not.toBeInTheDocument();""",
)
replace(
    test,
    """    expect(
      within(scanInfoPopover).getByText(/Zakres: 254 adresy.*1 min 36 s/)
    ).toBeInTheDocument();""",
    """    expect(
      within(dialog).getByText(/Zakres: 254 adresy.*1 min 36 s/)
    ).toBeInTheDocument();""",
)
replace(
    test,
    """    expect(
      within(scanInfoPopover).getByText(/Zakres: 32 adresy.*12 s/)
    ).toBeInTheDocument();""",
    """    expect(within(dialog).getByText(/Zakres: 32 adresy.*12 s/)).toBeInTheDocument();""",
)
replace(
    test,
    "    expect(within(xiaomiItem!).getByText('-72 dBm')).toBeInTheDocument();",
    """    await waitFor(() =>
      expect(within(xiaomiItem!).getByText('-72 dBm')).toBeInTheDocument()
    );""",
)
replace(
    test,
    "    expect(within(candidateItems[1]!).getByText('-70 dBm')).toBeInTheDocument();",
    """    await waitFor(() =>
      expect(within(candidateItems[1]!).getByText('-70 dBm')).toBeInTheDocument()
    );""",
)

print('Remaining device add page regressions fixed')
