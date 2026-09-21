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
      id: 'shellyplugsg3-button-e2e',
      name: 'Salon',
      baseUrl: 'http://192.168.0.20/',
      scriptIdInput: '1',
      model: 'S3PL-00112EU',
      gen: 3
    }
  ],
  sensorDevices: [],
  selectedShellyId: 'shellyplugsg3-button-e2e',
  selectedSensorId: null,
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

const leds = {
  mode: 'switch',
  colors: {
    'switch:0': {
      on: { rgb: [0, 100, 0], brightness: 100 },
      off: { rgb: [100, 0, 0], brightness: 100 }
    },
    power: { brightness: 100 }
  },
  night_mode: {
    enable: false,
    brightness: 100,
    active_between: []
  }
};

const seedSavedPlug = async (page: Page) => {
  await page.addInitScript((draft) => {
    window.localStorage.setItem('lcl.hardwareSetupDraft.v8', JSON.stringify(draft));
  }, savedPlugDraft);
};

const mockShelly = async (page: Page) => {
  let buttonMode: 'momentary' | 'detached' = 'momentary';
  const setConfigs: unknown[] = [];

  const handleRpc = async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as {
      id?: number | string;
      method?: string;
      params?: {
        config?: {
          controls?: { 'switch:0'?: { in_mode?: 'momentary' | 'detached' } };
        };
      };
    };

    let result: unknown = {};
    switch (body.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
          id: 'shellyplugsg3-button-e2e',
          model: 'S3PL-00112EU',
          gen: 3,
          fw_id: '20260311-095902/1.7.5-g9979d16'
        };
        break;
      case 'Shelly.GetStatus':
        result = {
          matter: { enabled: false },
          script: { enable: true },
          ble: { enable: true },
          'switch:0': {
            id: 0,
            output: false,
            apower: 0,
            voltage: 230.1,
            current: 0,
            aenergy: { total: 1250 },
            temperature: { tC: 31.2 }
          },
          wifi: { rssi: -55 },
          sys: {
            time: '14:00',
            unixtime: 1_782_820_000,
            uptime: 3600,
            last_sync_ts: 1_782_819_900
          }
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
          methods: ['Shelly.GetStatus', 'PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig']
        };
        break;
      case 'PLUGS_UI.GetConfig':
        result = {
          leds,
          controls: { 'switch:0': { in_mode: buttonMode } }
        };
        break;
      case 'PLUGS_UI.SetConfig': {
        const config = body.params?.config ?? {};
        setConfigs.push(config);
        const nextMode = config.controls?.['switch:0']?.in_mode;
        if (nextMode) buttonMode = nextMode;
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
  await page.route('http://192.168.0.20/rpc', handleRpc);
  return {
    setConfigs,
    buttonMode: () => buttonMode
  };
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
              className: element.className.toString(),
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
  await expect(page.getByRole('heading', { name: 'Przycisk gniazdka' })).toBeVisible();
};

for (const viewport of viewports) {
  test(`physical button mode fits Plug settings on ${viewport.name}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedSavedPlug(page);
    await mockShelly(page);
    await openPlugSettings(page);

    await expect(
      page.getByRole('button', { name: 'Tryb przycisku', exact: true })
    ).toContainText('Steruje przekaźnikiem');
    await expect(
      page.getByText('Fizyczny przycisk przełącza przekaźnik ON/OFF.')
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test('physical button mode writes only PLUGS_UI controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSavedPlug(page);
  const mock = await mockShelly(page);
  await openPlugSettings(page);

  await page.getByRole('button', { name: 'Tryb przycisku', exact: true }).click();
  await page.getByRole('option', { name: 'Odłączony od przekaźnika' }).click();
  await expect(
    page.getByText('Fizyczny przycisk nie zmienia stanu przekaźnika.')
  ).toBeVisible();
  await page.getByRole('button', { name: 'Zapisz tryb przycisku' }).click();

  await expect(page.getByText('Tryb przycisku zapisany.')).toBeVisible();
  expect(mock.buttonMode()).toBe('detached');
  expect(mock.setConfigs).toEqual([
    {
      controls: {
        'switch:0': { in_mode: 'detached' }
      }
    }
  ]);
  expect(JSON.stringify(mock.setConfigs)).not.toContain('"leds"');
  await expectNoHorizontalOverflow(page);
});
