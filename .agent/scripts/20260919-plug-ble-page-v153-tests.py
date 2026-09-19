from pathlib import Path

path = Path('apps/mobile/src/__tests__/navigation-settings-regression.test.tsx')
text = path.read_text()
old = """    expect(
      screen.getByRole('button', { name: 'Skanuj termometry BLE przez to gniazdko' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: '‹ Gniazdka' }));
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
"""
new = """    const scanBle = screen.getByRole('button', {
      name: 'Skanuj termometry BLE przez to gniazdko'
    });
    expect(scanBle).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Usuń gniazdko tylko z aplikacji' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(scanBle);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Skanuj termometry BLE' })).toBeVisible();
    expect(screen.getByRole('button', { name: '‹ Nawilżacz' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByRole('button', { name: '‹ Nawilżacz' }));
    expect(await screen.findByRole('heading', { name: 'Nawilżacz' })).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '‹ Gniazdka' }));
    expect(screen.getByRole('heading', { name: 'dashboard-test' })).toBeVisible();
"""
if old not in text:
    raise SystemExit('plug settings navigation assertion block not found')
path.write_text(text.replace(old, new, 1))
print('Plug BLE discovery child-page regression test patched')
