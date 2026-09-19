from pathlib import Path

ROOT = Path('.')

def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')

test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace(
    test,
    "    fireEvent.click(within(sensorAddDialog).getByRole('button', { name: 'Zamknij' }));",
    "    closeCurrentAddPage();",
)
replace(
    test,
    """    await waitFor(() =>
      expect(within(xiaomiItem!).getByText('-72 dBm')).toBeInTheDocument()
    );""",
    """    await waitFor(() => {
      const latestXiaomiItem = screen.getByText('A4:C1:38:4F:24:CD').closest('article');
      expect(latestXiaomiItem).not.toBeNull();
      expect(within(latestXiaomiItem!).getByText('-72 dBm')).toBeInTheDocument();
    });""",
)
replace(
    test,
    """    await waitFor(() =>
      expect(within(candidateItems[1]!).getByText('-70 dBm')).toBeInTheDocument()
    );""",
    """    await waitFor(() => {
      const latestTp357Item = screen.getByText('F7:5F:8D:0F:76:20').closest('article');
      expect(latestTp357Item).not.toBeNull();
      expect(within(latestTp357Item!).getByText('-70 dBm')).toBeInTheDocument();
    });""",
)

print('Final device add page test migration applied')
