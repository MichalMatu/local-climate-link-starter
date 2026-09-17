from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

# Dashboard: second nav is Thermometers; time automation is shown with its Plug.
path = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
replace(
    path,
    """    const timeNav = screen.getByRole('button', { name: 'Czas' });
    expect(timeNav).toBeEnabled();
    fireEvent.click(timeNav);
    expect(screen.getByText('Brak automatyzacji')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));
""",
    """    const thermometerNav = screen.getByRole('button', { name: 'Termometry' });
    expect(thermometerNav).toBeEnabled();
    fireEvent.click(thermometerNav);
    expect(screen.getByRole('heading', { name: 'Termometry' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Skanuj termometry BLE telefonem' })
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));
"""
)
replace(
    path,
    """    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const climateNav = screen.getByRole('button', { name: 'Gniazdka' });
    expect(climateNav).toBeEnabled();
    fireEvent.click(climateNav);
    expect(screen.getByText('Brak automatyzacji')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));

    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły' }));
""",
    """    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const thermometerNav = screen.getByRole('button', { name: 'Termometry' });
    expect(thermometerNav).toBeEnabled();
    fireEvent.click(thermometerNav);
    expect(screen.getByRole('heading', { name: 'Termometry' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Gniazdka' }));
    expect(screen.getByText('Harmonogram dzienny')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły' }));
"""
)

# Routes: Time is a per-plug automation intent, not a global dashboard tab.
path = 'apps/mobile/src/__tests__/app-routes.test.tsx'
replace(
    path,
    """  it('opens time setup directly from the Time plus and returns to Time dashboard', async () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Co chcesz zrobić?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
""",
    """  it('starts time setup from a saved plug and keeps that Shelly context', async () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.33/',
      name: 'Lampa',
      baseUrl: 'http://192.168.0.33/',
      scriptIdInput: '1'
    });
    renderRoutes();
    const card = screen.getByText('Lampa').closest('article');
    expect(card).not.toBeNull();
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    expect(screen.getByRole('button', { name: /Sterować według czasu/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    expect(screen.getByText('mock-fixed-shelly-http://192.168.0.33/')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-back' }));
    expect(screen.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  });
"""
)
replace(
    path,
    """  it('completes direct Time setup back to the Time dashboard', async () => {
    renderRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Czas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj automatykę' }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Czas' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
""",
    """  it('completes per-plug Time setup back to the Plugs dashboard', async () => {
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.34/',
      name: 'Pompa',
      baseUrl: 'http://192.168.0.34/',
      scriptIdInput: '1'
    });
    renderRoutes();
    const card = screen.getByText('Pompa').closest('article');
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    fireEvent.click(screen.getByRole('button', { name: /Sterować według czasu/ }));
    expect(await screen.findByText('mock-setup-time')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));
    expect(screen.getByRole('heading', { name: 'Gniazdka' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gniazdka' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
"""
)

# Detail nav now points to Thermometers (internal route key remains `time`).
path = 'apps/mobile/src/__tests__/automation-detail.test.tsx'
replace(
    path,
    "fireEvent.click(screen.getByRole('button', { name: 'Czas' }));",
    "fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));"
)
