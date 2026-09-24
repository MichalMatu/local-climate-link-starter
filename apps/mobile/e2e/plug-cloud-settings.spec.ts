import { expect, test, type Page, type Route } from '@playwright/test';

const viewports = [
  { name: 'phone-small', width: 360, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 }
] as const;

const savedPlugDraft = {
  shellyNameInput: 'Shelly Plug S Gen3',
  shellyUrlInput: '',
  sensorProfileInput: 'xiaomi_lywsd03mmc_bthome_v2',
  sensorMacInput: '',
  sensorNameInput: '',
  shellyDevices: [
    {
      id: 'shellyplugsg3-cloud-e2e',
      name: 'Salon',
      baseUrl: 'http://192.168.0.30/',
      scriptIdInput: '1',
      model: 'S3PL-00112EU',
      gen: 3
    }
  ],
  sensorDevices: [],
  selectedShellyId: 'shellyplugsg3-cloud-e2e',
  selectedSensorId: null,
  additionalSensorIds: [],
  sensorAggregation: 'avg',
  rulePreset: 'heating',
  onThresholdInput: '19',
  offThresholdInput: '20',
  vpdAssistEnabled: false,
  vpdTargetInput: '1.2',
  rssiMinInput: '-85',
  staleTimeoutMinInput: '2',
  minChangeMinInput: '2',
  maxOnHoursInput: '4'
};

const seedSavedPlug = async (page: Page) => {
  await page.addInitScript((draft) => {
    window.localStorage.setItem('lcl.hardwareSetupDraft.v9', JSON.stringify(draft));
  }, savedPlugDraft);
};

const mockShelly = async (page: Page) => {
  let cloudEnabled = false;
  const setConfigs: unknown[] = [];

  const handleRpc = async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as {
      id?: number | string;
      method?: string;
      params?: { config?: { enable?: boolean } };
    };
    let result: unknown = {};

    switch (body.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
          id: 'shellyplugsg3-cloud-e2e',
          model: 'S3PL-00112EU',
          gen: 3,
          fw_id: '20260311-095902/1.7.5-g9979d16'
        };
        break;
      case 'Shelly.GetStatus':
        result = {
          matter: { enabled: false },
          'script:1': { id: 1, running: true },
          ble: { enable: true },
          'switch:0': { id: 0, output: false, apower: 0, voltage: 230.1, current: 0 },
          wifi: { rssi: -55 },
          sys: { time: '14:00', unixtime: 1_782_820_000, uptime: 3600 }
        };
        break;
      case 'Script.List':
        result = { scripts: [] };
        break;
      case 'Schedule.List':
        result = { jobs: [], rev: 1 };
        break;
      case 'Shelly.ListMethods':
        result = {
          methods: [
            'Shelly.GetStatus',
            'Cloud.GetConfig',
            'Cloud.SetConfig',
            'Cloud.GetStatus'
          ]
        };
        break;
      case 'Cloud.GetConfig':
        result = {
          enable: cloudEnabled,
          server: 'shelly-195-eu.shelly.cloud:6022/jrpc'
        };
        break;
      case 'Cloud.GetStatus':
        result = { connected: cloudEnabled };
        break;
      case 'Cloud.SetConfig': {
        const config = body.params?.config ?? {};
        setConfigs.push(config);
        if (config.enable !== undefined) cloudEnabled = config.enable;
        result = { restart_required: false };
        break;
      }
      default:
        result = {};
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: body.id ?? 1, result })
    });
  };

  await page.route('**/__lcl_shelly_proxy?**', handleRpc);
  await page.route('http://192.168.0.30/rpc', handleRpc);
  return { setConfigs, cloudEnabled: () => cloudEnabled };
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = document.documentElement.scrollWidth - viewportWidth;
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .map((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const hasSize = rect.width > 0 && rect.height > 0;
        const allowsHorizontalScroll =
          style.overflowX === 'auto' || style.overflowX === 'scroll';
        const leavesViewport = rect.left < -1 || rect.right > viewportWidth + 1;
        return !hasSize || allowsHorizontalScroll || !leavesViewport
          ? null
          : {
              tag: element.tagName.toLowerCase(),
              text: element.textContent?.trim().slice(0, 80) ?? ''
            };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 6);
    return { documentOverflow, offenders };
  });
  expect(overflow.documentOverflow).toBeLessThanOrEqual(1);
  expect(overflow.offenders).toEqual([]);
};

const openPlugSettings = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ustawienia gniazdka: Salon' }).click();
  await expect(page.getByRole('heading', { name: 'Salon' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shelly Cloud' })).toBeVisible();
};

for (const viewport of viewports) {
  test(`Shelly Cloud setting fits Plug settings on ${viewport.name}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedSavedPlug(page);
    await mockShelly(page);
    await openPlugSettings(page);

    await expect(
      page.getByRole('checkbox', { name: 'Włącz Shelly Cloud' })
    ).not.toBeChecked();
    await expect(
      page.getByText(
        'Shelly Cloud jest wyłączona. Shelly Link nadal działa w sieci lokalnej.'
      )
    ).toBeVisible();
    await expect(page.getByText('Połączenie z chmurą: Brak połączenia')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('Shelly Cloud setting writes only the Cloud enable flag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSavedPlug(page);
  const mock = await mockShelly(page);
  await openPlugSettings(page);

  await page.getByRole('checkbox', { name: 'Włącz Shelly Cloud' }).click();
  await page.getByRole('button', { name: 'Zapisz ustawienie chmury' }).click();

  await expect(page.getByText('Ustawienie chmury zapisane.')).toBeVisible();
  expect(mock.cloudEnabled()).toBe(true);
  expect(mock.setConfigs).toEqual([{ enable: true }]);
  await expect(page.getByText('Połączenie z chmurą: Połączono')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
