from pathlib import Path
import re

ROOT = Path('.')

def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')


def regex_replace(path: str, pattern: str, repl: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    text2, n = re.subn(pattern, repl, text, count=count, flags=re.S)
    if n != count:
        raise SystemExit(f'regex expected {count} matches, got {n} in {path}: {pattern[:180]!r}')
    p.write_text(text2, encoding='utf-8')

# Preserve the useful Shelly scan help on the page without restoring a modal.
shelly = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(shelly, "import { Modal, ToastViewport } from '@lcl/ui';", "import { InfoPopover, Modal, ToastViewport } from '@lcl/ui';")
replace(
    shelly,
    """          <div className=\"installation-section-heading\">
            <h1>{t('hardware.shelly.add')}</h1>
          </div>""",
    """          <div className=\"installation-section-heading\">
            <h1>{t('hardware.shelly.add')}</h1>
            <InfoPopover
              label={t('hardware.shelly.infoScanLabel')}
              title={t('hardware.shelly.infoScanTitle')}
            >
              {shellyScanEstimate}
              <br />
              <br />
              {t('hardware.shelly.scannerBehavior')}
            </InfoPopover>
          </div>""",
)
replace(shelly, "              <p className=\"device-add-page__hint\">{shellyScanEstimate}</p>\n", "")

# The BLE tab is now navigation inside a child page; keep the explanatory title.
sensor = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace(
    sensor,
    """            role=\"tab\"
            aria-selected={addMode === 'phone-scan'}
            onClick={() => selectAddMode('phone-scan')}""",
    """            role=\"tab\"
            aria-selected={addMode === 'phone-scan'}
            title={t('hardware.sensor.scanPhoneTitle')}
            onClick={() => selectAddMode('phone-scan')}""",
)
replace(
    sensor,
    "  onAddRequest?: () => void;",
    "  onAddRequest?: (mode: SensorAddMode) => void;",
)
replace(sensor, "        onClick={onAddRequest}", "        onClick={() => onAddRequest?.(primaryAddAction)}")

# Keep entry intent: Dashboard thermometer FAB -> BLE scan, setup Sensor + -> manual form.
hardware = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
replace(hardware, "type LocalAddPage = 'plug' | 'sensor' | null;", "type SensorAddMode = 'manual' | 'phone-scan';\ntype LocalAddPage = 'plug' | 'sensor' | null;")
replace(
    hardware,
    "  onOpenSensorAdd?: () => void;\n  fixedShellyId?: string;",
    "  onOpenSensorAdd?: (mode: SensorAddMode) => void;\n  fixedShellyId?: string;",
)
replace(
    hardware,
    "  sensorAddOnly?: boolean;\n  onPlugAddComplete?: () => void;",
    "  sensorAddOnly?: boolean;\n  sensorAddMode?: SensorAddMode;\n  onPlugAddComplete?: () => void;",
)
replace(
    hardware,
    "  sensorAddOnly = false,\n  onPlugAddComplete,",
    "  sensorAddOnly = false,\n  sensorAddMode = 'phone-scan',\n  onPlugAddComplete,",
)
replace(
    hardware,
    "  const [localAddPage, setLocalAddPage] = useState<LocalAddPage>(null);",
    "  const [localAddPage, setLocalAddPage] = useState<LocalAddPage>(null);\n  const [localSensorAddMode, setLocalSensorAddMode] = useState<SensorAddMode>('manual');",
)
replace(
    hardware,
    "  const openSensorAdd = onOpenSensorAdd ?? (() => setLocalAddPage('sensor'));",
    """  const openSensorAdd =
    onOpenSensorAdd ??
    ((mode: SensorAddMode) => {
      setLocalSensorAddMode(mode);
      setLocalAddPage('sensor');
    });""",
)
replace(
    hardware,
    "            primaryAddAction=\"phone-scan\"\n            onAddComplete={closeLocalAdd}",
    "            primaryAddAction={localSensorAddMode}\n            onAddComplete={closeLocalAdd}",
)
replace(
    hardware,
    "          primaryAddAction={sensorAddOnly ? 'phone-scan' : 'manual'}",
    "          primaryAddAction={sensorAddOnly ? sensorAddMode : 'manual'}",
)

routes = 'apps/mobile/src/routes/AppRoutes.tsx'
replace(
    routes,
    "  returnTo: DeviceAddReturnRoute;\n};",
    "  returnTo: DeviceAddReturnRoute;\n  sensorMode?: 'manual' | 'phone-scan';\n};",
)
replace(
    routes,
    "            sourceKind: 'time',\n            returnTo: { type: 'dashboard', kind: 'time' }",
    "            sourceKind: 'time',\n            returnTo: { type: 'dashboard', kind: 'time' },\n            sensorMode: 'phone-scan'",
)
replace(
    routes,
    "          {...(route.device === 'plug' ? { plugAddOnly: true } : { sensorAddOnly: true })}",
    """          {...(route.device === 'plug'
            ? { plugAddOnly: true }
            : { sensorAddOnly: true, sensorAddMode: route.sensorMode ?? 'manual' })}""",
)
replace(
    routes,
    "    const openDeviceAdd = (device: 'plug' | 'sensor') =>\n      navigate({\n        type: 'device-add',\n        device,\n        sourceKind: route.sourceKind,\n        returnTo: route\n      });",
    """    const openDeviceAdd = (
      device: 'plug' | 'sensor',
      sensorMode?: 'manual' | 'phone-scan'
    ) =>
      navigate({
        type: 'device-add',
        device,
        sourceKind: route.sourceKind,
        returnTo: route,
        ...(sensorMode ? { sensorMode } : {})
      });""",
)
replace(routes, "          onOpenSensorAdd={() => openDeviceAdd('sensor')}", "          onOpenSensorAdd={(mode) => openDeviceAdd('sensor', mode)}")

# Rewrite stale modal-specific tests to the page contract.
test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'

regex_replace(
    test,
    r"  it\('adds a scanned Shelly directly with an editable per-result name', async \(\) => \{.*?\n  \}\);",
    """  it('adds a scanned Shelly directly with an editable per-result name', async () => {
    renderHardwareSetup();

    const page = await openShellyAddDialog('scan');
    expect(within(page).getByLabelText('Od')).toHaveValue('192.168.0.1');
    expect(within(page).getByLabelText('Do')).toHaveValue('192.168.0.254');

    fireEvent.click(within(page).getByRole('button', { name: 'Rozpocznij skan' }));

    expect(await within(page).findByText('http://192.168.0.20/')).toBeInTheDocument();
    expect(within(page).getByText('S3PL-00112EU, gen 3')).toBeInTheDocument();
    const scannedName = within(page).getByRole('textbox', {
      name: 'Nazwa gniazdka: http://192.168.0.20/'
    });
    expect(scannedName).toHaveValue('S3PL-00112EU');
    const scannedNameField = scannedName.closest('label');
    const scannedRow = scannedName.closest('.shelly-scan-result__row');
    expect(scannedNameField).toHaveClass('field', 'shelly-scan-result__name');
    expect(scannedRow).not.toBeNull();
    expect(scannedRow?.children[0]).toBe(scannedNameField);
    expect(scannedRow?.children[1]).toHaveTextContent('Adres');
    expect(scannedRow?.children[2]).toHaveTextContent('Model');
    fireEvent.change(scannedName, { target: { value: 'Salon' } });

    fireEvent.click(
      within(page).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })
    );

    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('Salon')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dodaj gniazdko' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();
  });""",
)

# Page heading hosts the same shared info popover instead of a modal title row.
replace(
    test,
    "    expect(tooltipButton.closest('.lcl-modal__title-row')).not.toBeNull();\n    expect(tooltipButton.closest('.shelly-network-scan__body')).toBeNull();",
    "    expect(tooltipButton.closest('.installation-section-heading')).not.toBeNull();\n    expect(tooltipButton.closest('.shelly-network-scan__body')).toBeNull();",
)
replace(
    test,
    "    expect(screen.getByRole('dialog', { name: 'Dodaj gniazdko' })).toBe(dialog);",
    "    expect(screen.queryByRole('dialog', { name: 'Dodaj gniazdko' })).toBeNull();\n    expect(screen.getByRole('heading', { name: 'Dodaj gniazdko' })).toBeVisible();",
)

regex_replace(
    test,
    r"  it\('uses the discovered model as the default scanner name without populating the manual form', async \(\) => \{.*?\n  \}\);",
    """  it('uses the discovered model as the default scanner name without populating the manual form', async () => {
    renderHardwareSetup();

    let page = await openShellyAddDialog('scan');
    const manualTab = within(page).getByRole('tab', { name: 'Dodaj ręcznie' });
    const scanTab = within(page).getByRole('tab', { name: 'Skanuj sieć' });
    fireEvent.click(manualTab);
    const manualName = within(page).getByRole('textbox', { name: /^Nazwa gniazdka$/ });
    const manualAddress = within(page).getByLabelText('Adres IP Shelly');
    const initialManualName = (manualName as HTMLInputElement).value;
    const initialManualAddress = (manualAddress as HTMLInputElement).value;
    fireEvent.click(scanTab);

    fireEvent.click(within(page).getByRole('button', { name: 'Rozpocznij skan' }));
    await within(page).findByText('http://192.168.0.20/');

    expect(
      within(page).getByRole('textbox', {
        name: 'Nazwa gniazdka: http://192.168.0.20/'
      })
    ).toHaveValue('S3PL-00112EU');
    fireEvent.click(
      within(page).getByRole('button', { name: 'Dodaj: http://192.168.0.20/' })
    );

    const savedPlugList = await screen.findByLabelText('Dodane gniazdka');
    expect(within(savedPlugList).getByText('S3PL-00112EU')).toBeInTheDocument();

    page = await openShellyAddDialog('manual');
    expect(within(page).getByRole('textbox', { name: /^Nazwa gniazdka$/ })).toHaveValue(
      initialManualName
    );
    expect(within(page).getByLabelText('Adres IP Shelly')).toHaveValue(
      initialManualAddress
    );
  });""",
)

replace(
    test,
    "    fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));\n\n    await waitFor(() => expect(abortableFetch.getAbortCount()).toBeGreaterThan(0));",
    "    closeCurrentAddPage();\n\n    await waitFor(() => expect(abortableFetch.getAbortCount()).toBeGreaterThan(0));",
)

regex_replace(
    test,
    r"  it\('opens a dedicated phone BLE scan modal and keeps result order stable', async \(\) => \{.*?\n  \}\);",
    """  it('uses the thermometer add child page for phone BLE scan and keeps result order stable', async () => {
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    let page = await openSensorAddDialog();
    const scanTab = within(page).getByRole('tab', { name: 'Skanuj BLE' });
    expect(scanTab).toHaveAttribute('title', 'Skanuj termometry BLE telefonem');
    fireEvent.click(scanTab);

    expect(screen.queryByRole('dialog', { name: 'Skanuj BLE telefonem' })).toBeNull();
    let xiaomiAddress = await findBleScanCandidate(page);
    let xiaomiItem = xiaomiAddress.closest('article');
    expect(xiaomiItem).not.toBeNull();
    expect(
      within(xiaomiItem!).getByRole('button', { name: 'Zapisz termometr' })
    ).toHaveAttribute('title', 'Zapisz ten termometr w aplikacji');
    expect(within(xiaomiItem!).getByText('BTHome v2')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('21.3°C')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('45.7%')).toBeInTheDocument();
    expect(within(xiaomiItem!).getByText('-72 dBm')).toBeInTheDocument();

    await waitFor(() => expect(within(page).getAllByRole('article')).toHaveLength(2));
    const candidateItems = within(page).getAllByRole('article');
    expect(within(candidateItems[0]!).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(candidateItems[1]!).getByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();
    expect(within(candidateItems[1]!).getByText('-70 dBm')).toBeInTheDocument();

    closeCurrentAddPage();
    expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();

    page = await openSensorAddDialog();
    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj BLE' }));
    xiaomiAddress = await findBleScanCandidate(page);
    xiaomiItem = xiaomiAddress.closest('article');
    expect(xiaomiItem).not.toBeNull();

    fireEvent.click(
      within(xiaomiItem!).getByRole('button', { name: 'Zapisz termometr' })
    );

    expect(screen.queryByRole('heading', { name: 'Dodaj termometr' })).toBeNull();
    expect(await screen.findByText('Termometr 24:CD')).toBeInTheDocument();
    expect(screen.getByText('21.3°C')).toBeInTheDocument();
    expect(screen.getByText('45.7%')).toBeInTheDocument();
    const sensorCard = getSavedSensorCard('Termometr 24:CD');
    expect(within(sensorCard).getByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(within(sensorCard).getByText('100%')).toBeInTheDocument();
  });""",
)

regex_replace(
    test,
    r"  it\('shows phone BLE scan startup errors as toast feedback', async \(\) => \{.*?\n  \}\);",
    """  it('shows phone BLE scan startup errors as toast feedback', async () => {
    phoneBleScannerMock.failureMessage = 'Phone BLE scan is unavailable in this runtime.';
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const page = await openSensorAddDialog();
    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj BLE' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      within(toastRegion)
        .getByText('Nie udało się uruchomić BLE.')
        .closest('[role=\"status\"]')
    ).not.toBeNull();
    expect(
      within(toastRegion).getByText(
        'Skan BLE z telefonu wymaga aplikacji mobilnej. W przeglądarce nie dostanę MAC termometru.'
      )
    ).toBeInTheDocument();
    expect(within(toastRegion).queryByText('Skanuję BLE z telefonu.')).not.toBeInTheDocument();
    expect(within(page).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Skanuj BLE telefonem' })).toBeNull();
  });""",
)

regex_replace(
    test,
    r"  it\('shows phone BLE permission errors as actionable toast feedback', async \(\) => \{.*?\n  \}\);",
    """  it('shows phone BLE permission errors as actionable toast feedback', async () => {
    phoneBleScannerMock.failureMessage = 'Permission denied.';
    renderHardwareSetup();

    fireEvent.click(screen.getByRole('button', { name: 'Termometry' }));
    const page = await openSensorAddDialog();
    fireEvent.click(within(page).getByRole('tab', { name: 'Skanuj BLE' }));

    const toastRegion = await screen.findByRole('region', { name: 'Powiadomienia' });
    expect(
      within(toastRegion).getByText(
        'Zezwól aplikacji na Bluetooth/Urządzenia w pobliżu i Lokalizację, potem uruchom skan ponownie.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Skanuj BLE telefonem' })).toBeNull();
  });""",
)

print('Full-page device add UX and remaining modal-specific tests updated')
