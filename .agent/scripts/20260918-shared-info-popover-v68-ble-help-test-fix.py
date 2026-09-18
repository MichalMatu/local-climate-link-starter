from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = path.read_text()
old = """    expect(
      within(dialog).getByRole('button', { name: 'Informacja o skanowaniu BLE' })
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('tooltip')).toHaveTextContent(
      'Shelly uruchomi osobny skrypt skanera BLE. Przekaźnik zostanie ustawiony na OFF, a po zakończeniu skanu wznowię automatyzację, jeśli była uruchomiona.'
    );
"""
new = """    const bleInfoButton = within(dialog).getByRole('button', {
      name: 'Informacja o skanowaniu BLE'
    });
    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(bleInfoButton);
    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(dialog).getByRole('tooltip', {
        name: 'Na czas skanowania zatrzymuję automatyzację'
      })
    ).toHaveTextContent(
      'Shelly uruchomi osobny skrypt skanera BLE. Przekaźnik zostanie ustawiony na OFF, a po zakończeniu skanu wznowię automatyzację, jeśli była uruchomiona.'
    );
    fireEvent.click(bleInfoButton);
    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'false');
"""
if text.count(old) != 1:
    raise SystemExit(f'expected one legacy BLE tooltip assertion block, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('Updated Shelly BLE help test for lazy shared InfoPopover rendering')
