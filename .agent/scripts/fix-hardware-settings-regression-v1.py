from pathlib import Path

p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()
old = """  it('opens production app settings from diagnostics', async () => {
    renderHardwareSetup();

    openDeveloperDiagnostics();
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia aplikacji' }));

    const settingsDialog = await screen.findByRole('dialog', {
      name: 'Ustawienia aplikacji'
    });
    expect(within(settingsDialog).getByText('Język')).toBeInTheDocument();
    expect(within(settingsDialog).getByText('Wygląd')).toBeInTheDocument();
    expect(within(settingsDialog).getByText('Diagnostyka wsparcia')).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(settingsDialog).getByRole('button', { name: 'English' }));
    });
    await waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(within(settingsDialog).getByText('Language')).toBeInTheDocument();

    act(() => {
      fireEvent.click(within(settingsDialog).getByRole('button', { name: 'Dark' }));
    });
    expect(document.documentElement.getAttribute('data-lcl-theme')).toBe('dark');
    expect(
      within(settingsDialog).getByRole('button', { name: 'Copy support report' })
    ).toBeInTheDocument();
  });
"""
new = """  it('does not duplicate app settings inside developer diagnostics', () => {
    renderHardwareSetup();

    openDeveloperDiagnostics();

    expect(
      screen.queryByRole('button', { name: 'Ustawienia aplikacji' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Ustawienia aplikacji' })
    ).not.toBeInTheDocument();
  });
"""
if s.count(old) != 1:
    raise SystemExit(f'unexpected legacy hardware settings test count: {s.count(old)}')
p.write_text(s.replace(old, new, 1))
print('hardware settings regression updated')
