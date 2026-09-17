from pathlib import Path

path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
source = path.read_text()

def replace_between(start_marker: str, end_marker: str, replacement: str) -> None:
    global source
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    source = source[:start] + replacement + source[end:]

replace_between(
    "  it('shows saved Shelly controls and sends relay ON/OFF commands', async () => {",
    "  it('does not replay Shelly control toasts after returning to the Shelly page', async () => {",
    """  it('renders saved Shelly status and settings without runtime automation controls', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    expect(
      within(savedPlugList).queryByRole('button', { name: 'http://192.168.0.20/' })
    ).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Przekaźnik')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Tryb')).not.toBeInTheDocument();
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(within(savedPlugList).queryByRole('button', { name })).not.toBeInTheDocument();
    }

    expect(await within(savedPlugList).findByText('0.0 W')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('230 V')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('1.23 kWh')).toBeInTheDocument();

    const infoToggle = within(savedPlugList).getByRole('button', {
      name: 'Ustawienia gniazdka'
    });
    expect(infoToggle).toHaveAttribute('title', 'Ustawienia gniazdka');
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeInTheDocument();
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Usuń gniazdko tylko z aplikacji'
      })
    ).toHaveClass('icon-action--danger');

    fireEvent.click(infoToggle);
    const infoDialog = await screen.findByRole('dialog', { name: 'Przedpokój' });
    expect(within(infoDialog).getByText('Adres IP')).toBeInTheDocument();
    expect(
      within(infoDialog).getByRole('link', {
        name: 'Otwórz panel Shelly: http://192.168.0.20/'
      })
    ).toBeInTheDocument();
    expect(within(infoDialog).getByText('Firmware')).toBeInTheDocument();
    expect(
      within(infoDialog).getByText('20260311-095902/1.7.5-g9979d16')
    ).toBeInTheDocument();
    const detailRows = infoDialog.querySelector('.status-stack');
    expect(detailRows).not.toBeNull();
    expect(within(detailRows as HTMLElement).queryByText('Przekaźnik')).not.toBeInTheDocument();
    expect(within(detailRows as HTMLElement).queryByText('Tryb')).not.toBeInTheDocument();
    fireEvent.click(within(infoDialog).getByRole('button', { name: 'Zamknij' }));

    const rpcMethods = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]).method)
      .filter(Boolean);
    expect(rpcMethods).not.toContain('Script.Start');
    expect(rpcMethods).not.toContain('Script.Stop');
    expect(rpcMethods).not.toContain('Switch.Set');
  });

"""
)

replace_between(
    "  it('does not replay Shelly control toasts after returning to the Shelly page', async () => {",
    "  it('switches saved Shelly automation between MANUAL and AUTO safely', async () => {",
    ""
)

replace_between(
    "  it('switches saved Shelly automation between MANUAL and AUTO safely', async () => {",
    "  it('renders a saved Shelly plug in final shape and refreshes status after reload', async () => {",
    """  it('keeps installed-runtime ownership out of generic Shelly setup', async () => {
    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(within(savedPlugList).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(
      within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeInTheDocument();

    const runtimeMutations = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]).method)
      .filter((method) => ['Script.Start', 'Script.Stop', 'Switch.Set'].includes(method ?? ''));
    expect(runtimeMutations).toEqual([]);
  });

"""
)

replace_between(
    "  it('renders a saved Shelly plug in final shape and refreshes status after reload', async () => {",
    "  it('removes a saved Shelly plug from the card action icon after confirmation', async () => {",
    """  it('renders a saved Shelly plug in final setup shape and refreshes status', async () => {
    useHardwareSetupDraftStore.setState({
      ...DEFAULT_HARDWARE_SETUP_DRAFT,
      shellyDevices: [
        {
          id: 'http://192.168.0.20/',
          name: 'Shelly Plug S Gen3',
          baseUrl: 'http://192.168.0.20/',
          scriptIdInput: '1'
        }
      ],
      selectedShellyId: 'http://192.168.0.20/',
      diagnosticShellyId: 'http://192.168.0.20/'
    });

    renderHardwareSetup();

    expect(screen.queryByText('nieznany')).not.toBeInTheDocument();
    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('Shelly Plug S Gen3')).toBeInTheDocument();
    expect(within(savedPlugList).queryByLabelText('Nazwa')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Moc')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Napięcie')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Energia')).not.toBeInTheDocument();
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(within(savedPlugList).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(
      within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();

    expect(await within(savedPlugList).findByText('0.0 W')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('230 V')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('1.23 kWh')).toBeInTheDocument();
  });

"""
)

replace_between(
    "  it('explains that rule save is required before AUTO or MANUAL controls', async () => {",
    "  it('scans the local network inside the add task and fills the form before adding', async () => {",
    """  it('keeps a saved Shelly manageable before any automation exists', async () => {
    vi.mocked(fetch).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const body = requestBody(init);

        if (url.pathname === '/rpc' && url.hostname !== '192.168.0.20') {
          return new Response('<!doctype html><html></html>', {
            status: 200,
            headers: { 'content-type': 'text/html' }
          });
        }

        switch (body.method) {
          case 'Shelly.GetDeviceInfo':
            return rpcResult({ model: 'S3PL-00112EU', gen: 3 });
          case 'Shelly.GetStatus':
            return rpcResult({
              ble: {},
              script: {},
              'switch:0': { id: 0, output: false }
            });
          case 'Script.List':
            return rpcResult({ scripts: [] });
          default:
            return rpcResult({});
        }
      }
    );

    renderHardwareSetup();
    await addShellyThroughUi();

    const savedPlugList = screen.getByLabelText('Dodane gniazdka');
    for (const name of ['AUTO', 'MANUAL', 'ON', 'OFF']) {
      expect(within(savedPlugList).queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(
      within(savedPlugList).getByRole('button', { name: 'Ustawienia gniazdka' })
    ).toBeInTheDocument();
    expect(
      within(savedPlugList).getByRole('button', {
        name: 'Skanuj termometry BLE przez to gniazdko'
      })
    ).toBeInTheDocument();

    const rpcMethods = vi
      .mocked(fetch)
      .mock.calls.map((call) => requestBody(call[1]).method)
      .filter(Boolean);
    expect(rpcMethods).not.toContain('Script.Start');
    expect(rpcMethods).not.toContain('Script.Stop');
    expect(rpcMethods).not.toContain('Switch.Set');
  });

"""
)

path.write_text(source)
