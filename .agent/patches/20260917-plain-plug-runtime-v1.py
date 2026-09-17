from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, count))


screen = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace(
    screen,
    "import { TimeAutomationCard } from './TimeAutomationCard.js';\n",
    "import { useShellyControlFlow } from '../flows/hardware-setup/useShellyControlFlow.js';\nimport { TimeAutomationCard } from './TimeAutomationCard.js';\n"
)
old_card = """const PlainPlugCard = ({
  device,
  onAddAutomation
}: {
  device: ShellyDraftDevice;
  onAddAutomation(): void;
}) => {
  const { t } = useTranslation();
  return (
    <article className="automation-card plug-card plug-card--unconfigured">
      <header className="automation-card__header">
        <span className="automation-card__leading-icon" aria-hidden="true">
          <IconPlug className="automation-card__icon" />
        </span>
        <div className="automation-card__identity">
          <h2>{device.name}</h2>
          <p>{t('dashboard.emptyCategory')}</p>
        </div>
      </header>
      <button
        className="primary-action plug-card__automation-action"
        type="button"
        onClick={onAddAutomation}
      >
        {t('dashboard.addAutomation')}
      </button>
    </article>
  );
};
"""
new_card = """const PlainPlugCard = ({
  device,
  onAddAutomation
}: {
  device: ShellyDraftDevice;
  onAddAutomation(): void;
}) => {
  const { t } = useTranslation();
  const { shellyControlStates, refreshShellyControl, turnRelayOn, turnRelayOff } =
    useShellyControlFlow();
  const controlState = shellyControlStates[device.id];
  const status = controlState?.status ?? null;
  const relayState = status?.relayOn;
  const isBusy = controlState?.pendingAction != null;

  useEffect(() => {
    refreshShellyControl(device);
  }, [device.id, device.baseUrl]);

  return (
    <article className="automation-card plug-card plug-card--unconfigured">
      <header className="automation-card__header">
        <span
          className={`automation-card__leading-icon${
            relayState === true ? ' automation-card__leading-icon--active' : ''
          }`}
          aria-hidden="true"
        >
          <IconPlug className="automation-card__icon" />
        </span>
        <div className="automation-card__identity">
          <h2>{device.name}</h2>
          <p>{t('dashboard.emptyCategory')}</p>
        </div>
      </header>

      <div
        className="automation-card__plug-runtime"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatInstallationMetric(status?.telemetry.powerW, ' W', 1)}</span>
        <span>{formatInstallationMetric(status?.telemetry.voltageV, ' V', 0)}</span>
        <span>{formatPlugEnergy(status?.telemetry.energyWh)}</span>
        <span>{status?.clock.localTime ?? '—'}</span>
      </div>

      <div
        className="automation-relay-actions automation-card__relay-actions"
        role="group"
        aria-label={t('dashboard.output')}
      >
        <button
          className="automation-relay-button"
          type="button"
          aria-pressed={relayState === true}
          disabled={isBusy}
          onClick={() => {
            if (relayState !== true) turnRelayOn(device);
          }}
        >
          ON
        </button>
        <button
          className="automation-relay-button"
          type="button"
          aria-pressed={relayState === false}
          disabled={isBusy}
          onClick={() => {
            if (relayState !== false) turnRelayOff(device);
          }}
        >
          OFF
        </button>
      </div>

      <button
        className="primary-action plug-card__automation-action"
        type="button"
        onClick={onAddAutomation}
      >
        {t('dashboard.addAutomation')}
      </button>
    </article>
  );
};
"""
replace(screen, old_card, new_card)

# Extend the existing plain-plug regression test to prove real Shelly runtime and relay control.
test = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
old_test = """  it('shows a saved plug without automation and starts setup with that plug context', () => {
    const onAddAutomation = vi.fn();
    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.30/',
      name: 'Nawilżacz',
      baseUrl: 'http://192.168.0.30/',
      scriptIdInput: '1'
    });
    renderDashboard(onAddAutomation);
    const card = screen.getByText('Nawilżacz').closest('article');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('Brak automatyzacji')).toBeVisible();
    fireEvent.click(
      within(card as HTMLElement).getByRole('button', { name: 'Dodaj automatykę' })
    );
    expect(onAddAutomation).toHaveBeenCalledWith('climate', 'http://192.168.0.30/');
  });
"""
new_test = """  it('keeps a saved plug fully controllable after automation is removed', async () => {
    const onAddAutomation = vi.fn();
    let relayOn = false;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
        params?: { on?: boolean };
      };
      let result: unknown = {};
      switch (body.method) {
        case 'Shelly.GetDeviceInfo':
          result = { id: 'shellyplugsg3-plain', model: 'S3PL-00112EU', gen: 3 };
          break;
        case 'Shelly.GetStatus':
          result = {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': {
              id: 0,
              output: relayOn,
              apower: relayOn ? 28.4 : 0,
              voltage: 243.2,
              current: relayOn ? 0.12 : 0,
              aenergy: { total: 25160 }
            },
            wifi: { rssi: -55 },
            sys: { time: '09:48', unixtime: 1_782_667_904, uptime: 12_345 }
          };
          break;
        case 'Script.List':
          result = { scripts: [] };
          break;
        case 'Switch.Set':
          relayOn = body.params?.on === true;
          result = {};
          break;
      }
      return jsonResponse({ id: body.id ?? 1, result });
    });
    vi.stubGlobal('fetch', fetchMock);

    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.30/',
      name: 'Nawilżacz',
      baseUrl: 'http://192.168.0.30/',
      scriptIdInput: '1'
    });
    renderDashboard(onAddAutomation);

    const card = screen.getByText('Nawilżacz').closest('article');
    expect(card).not.toBeNull();
    const plugCard = card as HTMLElement;
    expect(within(plugCard).getByText('Brak automatyzacji')).toBeVisible();
    expect(await within(plugCard).findByText('0.0 W')).toBeVisible();
    expect(within(plugCard).getByText('243 V')).toBeVisible();
    expect(within(plugCard).getByText('25.16 kWh')).toBeVisible();
    expect(within(plugCard).getByText('09:48')).toBeVisible();

    const onButton = within(plugCard).getByRole('button', { name: 'ON' });
    const offButton = within(plugCard).getByRole('button', { name: 'OFF' });
    expect(offButton).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(onButton);
    await waitFor(() => expect(onButton).toHaveAttribute('aria-pressed', 'true'));
    expect(
      fetchMock.mock.calls.some(([, init]) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          method?: string;
          params?: { on?: boolean };
        };
        return body.method === 'Switch.Set' && body.params?.on === true;
      })
    ).toBe(true);

    fireEvent.click(within(plugCard).getByRole('button', { name: 'Dodaj automatykę' }));
    expect(onAddAutomation).toHaveBeenCalledWith('climate', 'http://192.168.0.30/');
  });
"""
replace(test, old_test, new_test)
