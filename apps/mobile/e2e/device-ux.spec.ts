import { expect, test, type Page, type Route } from '@playwright/test';

const plug = {
  version: 1,
  id: 'shellyplugsg3-e2e',
  profileId: 'shelly_plug_s_gen3',
  name: 'Salon Plug',
  baseUrl: 'http://192.168.0.20',
  model: 'S3PL-00112EU',
  gen: 3,
  createdAtMs: 1,
  updatedAtMs: 1
} as const;

const sensor = {
  version: 1,
  id: 'xiaomi_lywsd03mmc_bthome_v2:A4:C1:38:4F:24:CD',
  profileId: 'xiaomi_lywsd03mmc_bthome_v2',
  name: 'Przedpokój',
  runtimeAddress: 'A4:C1:38:4F:24:CD',
  createdAtMs: 1,
  updatedAtMs: 1
} as const;

const climateRule = {
  version: 1,
  id: 'climate-e2e',
  kind: 'climate',
  name: 'Ogrzewanie salonu',
  plugId: plug.id,
  relayId: 0,
  sensorId: sensor.id,
  config: {
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
  schedule: null,
  deployment: null,
  createdAtMs: 2,
  updatedAtMs: 2
} as const;

const seedRegistries = async (
  page: Page,
  values: {
    plugs?: unknown[];
    sensors?: unknown[];
    rules?: unknown[];
  } = {}
) => {
  await page.addInitScript(
    ({ plugs, sensors, rules }) => {
      window.localStorage.setItem(
        'lcl.plugs.v1',
        JSON.stringify({ version: 1, items: plugs })
      );
      window.localStorage.setItem(
        'lcl.sensors.v1',
        JSON.stringify({ version: 1, items: sensors })
      );
      window.localStorage.setItem(
        'lcl.rules.v1',
        JSON.stringify({ version: 1, items: rules })
      );
    },
    {
      plugs: values.plugs ?? [],
      sensors: values.sensors ?? [],
      rules: values.rules ?? []
    }
  );
};

const fulfillRpc = async (
  route: Route,
  options: { deviceId: string; relayOn?: boolean } = {
    deviceId: 'shellyplugsg3-e2e'
  }
) => {
  const requestBody = JSON.parse(route.request().postData() ?? '{}') as {
    id?: number | string;
    method?: string;
  };
  const relayOn = options.relayOn ?? false;
  let result: unknown = {};

  switch (requestBody.method) {
    case 'Shelly.GetDeviceInfo':
      result = {
        id: options.deviceId,
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
          output: relayOn,
          apower: 42.3,
          voltage: 230.1,
          current: 0.18,
          aenergy: { total: 1250 },
          temperature: { tC: 32.4 }
        },
        wifi: { rssi: -55 },
        sys: {
          time: '14:00',
          unixtime: 1782820000,
          uptime: 3600,
          last_sync_ts: 1782819900
        }
      };
      break;
    case 'Shelly.ListMethods':
      result = { methods: [] };
      break;
    case 'Switch.GetStatus':
      result = { id: 0, output: relayOn };
      break;
    default:
      result = {};
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: requestBody.id ?? 1, result })
  });
};

const mockSavedPlugRpc = async (page: Page) => {
  const handler = (route: Route) => fulfillRpc(route, { deviceId: plug.id });
  await page.route('**/__lcl_shelly_proxy?**', handler);
  await page.route(`${plug.baseUrl}/rpc`, handler);
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
};

test('restored Shelly card keeps rich telemetry, menu and rule-aware detail UX', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRegistries(page, {
    plugs: [plug],
    sensors: [sensor],
    rules: [climateRule]
  });
  await mockSavedPlugRpc(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Gniazdka', exact: true }).click();
  const card = page.locator('.shelly-saved-card');
  await expect(card).toContainText(plug.name);
  await expect(card.locator('.shelly-state-strip')).toContainText('Przekaźnik');
  await expect(card.locator('.shelly-state-strip')).toContainText('OFF');
  await expect(card.locator('.shelly-state-strip')).toContainText(climateRule.name);
  await expect(card.locator('.shelly-metrics-strip')).toContainText('42.3 W');
  await expect(card.locator('.shelly-metrics-strip')).toContainText('230 V');
  await expect(card.locator('.shelly-metrics-strip')).toContainText('1.25 kWh');
  await expect(card.locator('.shelly-metrics-strip')).toContainText('14:00');
  await expect(card.locator('.automation-card__menu')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await card.locator('.automation-card__menu').click();
  const dialog = page.getByRole('dialog', { name: plug.name });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Nazwa gniazdka')).toHaveValue(plug.name);
  await expect(dialog.getByText(climateRule.name)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ON', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'OFF', exact: true })).toBeDisabled();
  await expect(dialog.locator('.plug-detail-card__identity')).toContainText(plug.baseUrl);
  await expect(dialog.locator('.plug-detail-card__metrics')).toContainText('42.3 W');
  await expectNoHorizontalOverflow(page);
});

test('Add plug keeps plug-specific copy and LAN scan can select and register a found Shelly', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRegistries(page);

  await page.route('**/__lcl_shelly_proxy?**', async (route) => {
    const target = new URL(route.request().url()).searchParams.get('target') ?? '';
    const deviceId = target.includes('192.168.0.21')
      ? 'shellyplugsg3-scan-e2e'
      : 'shellyplugsg3-other-e2e';
    await fulfillRpc(route, { deviceId });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Gniazdka', exact: true }).click();
  await page.getByRole('button', { name: 'Dodaj gniazdko' }).click();

  const dialog = page.getByRole('dialog', { name: 'Dodaj gniazdko' });
  await expect(dialog.getByLabel('Nazwa gniazdka')).toBeVisible();
  await expect(dialog.getByText('Nazwa termometru')).toHaveCount(0);
  await expect(dialog.getByText('Skanuj sieć')).toBeVisible();

  await dialog.getByLabel('Od').fill('192.168.0.21');
  await dialog.getByLabel('Do').fill('192.168.0.21');
  await dialog.getByRole('button', { name: 'Skanuj sieć' }).click();
  const found = dialog.getByRole('button', { name: 'http://192.168.0.21/' });
  await expect(found).toBeVisible();
  await found.click();
  await expect(dialog.getByLabel('Adres')).toHaveValue('http://192.168.0.21/');

  await dialog.getByLabel('Nazwa gniazdka').fill('Kuchnia');
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await expect(page.locator('.shelly-saved-card')).toContainText('Kuchnia');
  await expect(page.locator('.shelly-saved-card .shelly-metrics-strip')).toContainText(
    '42.3 W'
  );
  await expectNoHorizontalOverflow(page);
});

test('thermometer card keeps polished metrics and rule usage while schedule uses one-row weekdays and wheel picker', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRegistries(page, {
    plugs: [plug],
    sensors: [sensor],
    rules: [climateRule]
  });
  await page.goto('/');

  await page.getByRole('button', { name: 'Termometry', exact: true }).click();
  const sensorCard = page.locator('.sensor-saved-card');
  await expect(sensorCard).toContainText(sensor.name);
  await expect(sensorCard.locator('.sensor-metric-grid')).toContainText('Temperatura');
  await expect(sensorCard.locator('.sensor-metric-grid')).toContainText('Wilgotność');
  await expect(sensorCard.locator('.sensor-metric-grid')).toContainText('brak danych');
  await expect(sensorCard.locator('.sensor-card-details')).toContainText('Bateria');
  await expect(sensorCard.locator('.sensor-card-details')).toContainText('RSSI');
  await expect(sensorCard.locator('.sensor-card-details')).toContainText(
    sensor.runtimeAddress
  );
  await expect(sensorCard.locator('.sensor-rule-usage__link')).toContainText(
    climateRule.name
  );
  await expect(sensorCard.locator('.sensor-rule-usage__link')).toContainText(plug.name);
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Reguły', exact: true }).click();
  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await page.getByRole('button', { name: /Sterować według czasu/ }).click();

  const weekdays = page.locator('.rule-weekday');
  await expect(weekdays).toHaveCount(7);
  await expect(weekdays).toHaveText(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
  const weekdayTops = await weekdays.evaluateAll((items) =>
    items.map((item) => Math.round(item.getBoundingClientRect().top))
  );
  expect(Math.max(...weekdayTops) - Math.min(...weekdayTops)).toBeLessThanOrEqual(1);

  const onButton = page.getByRole('button', { name: /Włącz o: 08:00/ });
  const offButton = page.getByRole('button', { name: /Wyłącz o: 20:00/ });
  const [onBox, offBox] = await Promise.all([
    onButton.boundingBox(),
    offButton.boundingBox()
  ]);
  expect(onBox).not.toBeNull();
  expect(offBox).not.toBeNull();
  expect(Math.abs((onBox?.width ?? 0) - (offBox?.width ?? 0))).toBeLessThanOrEqual(1);

  await onButton.click();
  const picker = page.locator('.rule-inline-time-picker');
  await expect(picker).toBeVisible();
  await expect(picker.locator('.time-wheel-column')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'HH 08' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.getByRole('button', { name: 'HH 09' }).click();
  await page.getByRole('button', { name: 'MM 15' }).click();
  await picker.getByRole('button', { name: 'Zastosuj' }).click();
  await expect(page.getByRole('button', { name: /Włącz o: 09:15/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
