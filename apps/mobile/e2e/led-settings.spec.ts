import { expect, test, type Page, type Route } from '@playwright/test';

type InstallationKind = 'climate' | 'time';

const viewports = [
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: 'tablet', width: 768, height: 1024 }
] as const;

const climateInstallation = {
  version: 1,
  id: 'climate:shellyplugsg3-led-e2e:0',
  kind: 'climate',
  shelly: {
    deviceId: 'shellyplugsg3-led-e2e',
    name: 'Salon',
    baseUrl: 'http://192.168.0.20/',
    model: 'S3PL-00112EU',
    gen: 3
  },
  script: { id: 1, hash: 'lcl-led-e2e' },
  config: {
    version: 1,
    sensor: {
      profileId: 'xiaomi_lywsd03mmc_bthome_v2',
      sensorId: 'sensor-a4c1384f24cd',
      runtimeAddress: 'A4:C1:38:4F:24:CD',
      displayName: 'Przedpokój',
      parserValidated: true
    },
    output: { profileId: 'shelly_plug_s_gen3', relayId: 0 },
    rule: {
      mode: 'heating',
      control: {
        metric: 'temperature',
        direction: 'below',
        onThreshold: 19,
        offThreshold: 20
      },
      vpdAssist: { enabled: false, targetKpa: 1.2 },
      staleTimeoutSec: 120,
      minChangeMs: 120000,
      maxOnMs: 14400000,
      rssiMin: -85,
      consecutiveHits: 2,
      failSafe: 'off',
      bootState: 'off'
    },
    diagnostics: { enabled: true }
  },
  installedAtMs: 1782820000000,
  updatedAtMs: 1782820000000
};

const timeInstallation = {
  version: 1,
  id: 'time:shellyplugsg3-led-e2e:0',
  kind: 'time',
  shelly: {
    deviceId: 'shellyplugsg3-led-e2e',
    name: 'Lampa',
    baseUrl: 'http://192.168.0.20/',
    model: 'S3PL-00112EU',
    gen: 3
  },
  schedule: { onJobId: 7, offJobId: 8 },
  config: { relayId: 0, onTime: '08:00', offTime: '20:00' },
  installedAtMs: 1782820000000,
  updatedAtMs: 1782820000000
};

const seedInstallation = async (page: Page, kind: InstallationKind) => {
  await page.addInitScript(
    (installation) => {
      window.localStorage.setItem(
        'lcl.installedAutomations.v1',
        JSON.stringify({ version: 1, installations: [installation] })
      );
    },
    kind === 'climate' ? climateInstallation : timeInstallation
  );
};

const diagnosticPayload = () => ({
  v: 1,
  z: 'lcl-led-e2e',
  s: ['A4:C1:38:4F:24:CD', 'Przedpokój'],
  q: [0, 0, 19, 20, 120, -85],
  y: ['14:00', 1_782_820_000, 3600],
  p: [true, 42.3, 230.1, 0.2, 1250, 32.4],
  g: [
    3_550_000,
    21.4,
    55.2,
    91,
    -51,
    true,
    'ok',
    3_500_000,
    3_540_000,
    0,
    0,
    21.4,
    1.31,
    19,
    20,
    3_560_000,
    'ok'
  ]
});

const mockShelly = async (
  page: Page,
  kind: InstallationKind,
  options: { ledSupported?: boolean } = {}
) => {
  let ledMode: 'power' | 'switch' | 'off' = 'power';
  const ledSupported = options.ledSupported ?? true;

  const handleRpc = async (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const proxyTarget = requestUrl.searchParams.get('target');
    if (proxyTarget?.includes('/script/1/diag')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(diagnosticPayload())
      });
      return;
    }

    const body = JSON.parse(route.request().postData() ?? '{}') as {
      id?: number | string;
      method?: string;
      params?: {
        config?: { leds?: { mode?: 'power' | 'switch' | 'off' } };
      };
    };

    let result: unknown = {};
    switch (body.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
          id: 'shellyplugsg3-led-e2e',
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
            output: true,
            apower: 42.3,
            voltage: 230.1,
            current: 0.2,
            aenergy: { total: 1250 },
            temperature: { tC: 32.4 }
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
        result =
          kind === 'climate'
            ? {
                scripts: [
                  {
                    id: 1,
                    name: 'Local Climate Link Thermostat',
                    enable: true,
                    running: true
                  }
                ]
              }
            : { scripts: [] };
        break;
      case 'Schedule.List':
        result = {
          jobs: [
            {
              id: 7,
              enable: true,
              timespec: '0 0 8 * * SUN,MON,TUE,WED,THU,FRI,SAT',
              calls: [{ method: 'Switch.Set', params: { id: 0, on: true } }]
            },
            {
              id: 8,
              enable: true,
              timespec: '0 0 20 * * SUN,MON,TUE,WED,THU,FRI,SAT',
              calls: [{ method: 'Switch.Set', params: { id: 0, on: false } }]
            }
          ],
          rev: 2
        };
        break;
      case 'Shelly.ListMethods':
        result = {
          methods: ledSupported
            ? ['Shelly.GetStatus', 'PLUGS_UI.GetConfig', 'PLUGS_UI.SetConfig']
            : ['Shelly.GetStatus', 'Switch.Set']
        };
        break;
      case 'PLUGS_UI.GetConfig':
        result = {
          leds: {
            mode: ledMode,
            colors: {
              'switch:0': {
                on: { rgb: [0, 100, 0], brightness: 100 },
                off: { rgb: [100, 0, 0], brightness: 100 }
              },
              power: { brightness: 80 }
            }
          },
          controls: { 'switch:0': { in_mode: 'momentary' } }
        };
        break;
      case 'PLUGS_UI.SetConfig':
        ledMode = body.params?.config?.leds?.mode ?? ledMode;
        result = { restart_required: false };
        break;
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
              text: element.textContent?.trim().slice(0, 80) ?? '',
              left: Math.round(rect.left),
              right: Math.round(rect.right)
            };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 6);
    return { documentOverflow, offenders };
  });

  expect(overflow.documentOverflow).toBeLessThanOrEqual(1);
  expect(overflow.offenders).toEqual([]);
};

const consoleProblems = (page: Page) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
};

const openDetail = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  await page.getByRole('button', { name: 'Szczegóły' }).click();
  await expect(page.getByRole('heading', { name: 'LED gniazdka' })).toBeVisible();
};

for (const viewport of viewports) {
  test(`PLUGS_UI LED detail visual audit ${viewport.name}`, async ({ page }) => {
    const problems = consoleProblems(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedInstallation(page, 'climate');
    await mockShelly(page, 'climate');
    await openDetail(page);

    await expect(page.getByText('Zużycie energii')).toBeVisible();
    await expect(page.getByText('80%')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `test-results/visual-audit/plugs-ui-led-${viewport.name}.png`,
      fullPage: true
    });
    expect(problems).toEqual([]);
  });
}

test('PLUGS_UI LED relay-state and off presets work end to end', async ({ page }) => {
  const problems = consoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInstallation(page, 'climate');
  await mockShelly(page, 'climate');
  await openDetail(page);

  const card = page
    .getByRole('heading', { name: 'LED gniazdka' })
    .locator('xpath=ancestor::article[1]');
  await card.getByRole('button', { name: 'Sygnalizuj ON/OFF' }).click();
  await expect(card.getByText('Stan przekaźnika')).toBeVisible();
  await expect(card.getByText('RGB 0/100/0 · 100%')).toBeVisible();
  await expect(card.getByText('RGB 100/0/0 · 100%')).toBeVisible();
  await expect(page.getByText('LED pokazuje teraz stan przekaźnika.')).toBeVisible();

  await card.getByRole('button', { name: 'Wyłącz LED' }).click();
  await expect(card.getByText('Wyłączona')).toBeVisible();
  await expect(page.getByText('LED został wyłączony.')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test('unsupported PLUGS_UI is a stable non-error device state', async ({ page }) => {
  const problems = consoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInstallation(page, 'climate');
  await mockShelly(page, 'climate', { ledSupported: false });
  await openDetail(page);

  await expect(
    page.getByText(
      'To urządzenie lub firmware nie udostępnia ustawień PLUGS_UI. Pozostałe funkcje działają normalnie.'
    )
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sygnalizuj ON/OFF' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test('time installation exposes the same device-level LED settings', async ({ page }) => {
  const problems = consoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInstallation(page, 'time');
  await mockShelly(page, 'time');
  await openDetail(page);

  await expect(page.getByRole('heading', { name: 'Lampa' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LED gniazdka' })).toBeVisible();
  await expect(page.getByText('Zużycie energii')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(problems).toEqual([]);
});
