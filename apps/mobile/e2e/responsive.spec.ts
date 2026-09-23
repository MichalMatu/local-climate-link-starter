import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const e2eOrigin = `http://127.0.0.1:${process.env.LCL_E2E_PORT ?? '5173'}`;

const draft = {
  shellyNameInput: 'Shelly Plug S Gen3',
  shellyUrlInput: '',
  sensorProfileInput: 'xiaomi_lywsd03mmc_bthome_v2',
  sensorMacInput: '',
  sensorNameInput: '',
  shellyDevices: [
    {
      id: 'http://192.168.0.20/',
      name: 'Shelly Plug S Gen3',
      baseUrl: 'http://192.168.0.20/',
      scriptIdInput: '1'
    }
  ],
  sensorDevices: [
    {
      id: 'A4:C1:38:4F:24:CD',
      name: 'Przedpokój',
      runtimeAddress: 'A4:C1:38:4F:24:CD',
      profileId: 'xiaomi_lywsd03mmc_bthome_v2'
    }
  ],
  selectedShellyId: 'http://192.168.0.20/',
  selectedSensorId: 'A4:C1:38:4F:24:CD',
  additionalSensorIds: [],
  sensorAggregation: 'avg',
  diagnosticShellyId: 'http://192.168.0.20/',
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

const timeDraft = {
  ...draft,
  shellyDevices: draft.shellyDevices.map((device) => ({
    ...device,
    id: 'shellyplugsg3-time-e2e',
    model: 'S3PL-00112EU',
    gen: 3
  })),
  selectedShellyId: 'shellyplugsg3-time-e2e',
  diagnosticShellyId: 'shellyplugsg3-time-e2e'
};

const viewports = [
  { name: 'phone-small', width: 360, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-large', width: 412, height: 915 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
] as const;

const seedDraft = async (page: Page) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem('lcl.hardwareSetupDraft.v9', JSON.stringify(value));
  }, draft);
};

const seedTimeDraft = async (page: Page) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem('lcl.hardwareSetupDraft.v9', JSON.stringify(value));
  }, timeDraft);
};

const mockShellyRpc = async (page: Page) => {
  let scriptRunning = true;
  let relayOn = true;
  let runtimeMode = 0;

  const handleRpc = async (route: Route) => {
    const requestUrl = new URL(route.request().url());
    const proxyTarget = requestUrl.searchParams.get('target');
    if (proxyTarget?.includes('/script/1/diag')) {
      if (!scriptRunning) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ stopped: true })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          v: 1,
          z: 'lcl-e2e',
          s: ['A4:C1:38:4F:24:CD', 'Przedpokój'],
          q: [0, 0, 19, 20, 120, -85],
          y: ['14:00', 1782820000, 3600],
          p: [relayOn, relayOn ? 42.3 : 0, 230.1, relayOn ? 0.2 : 0, 1250, 32.4],
          g: [
            3550000,
            21.4,
            55.2,
            91,
            -51,
            relayOn,
            'ok',
            3500000,
            3540000,
            0,
            0,
            21.4,
            1.31,
            19,
            20,
            3560000,
            'ok'
          ]
        })
      });
      return;
    }

    const requestBody = JSON.parse(route.request().postData() ?? '{}') as {
      id?: number | string;
      method?: string;
      params?: { id?: number; on?: boolean; code?: string };
    };
    let result: unknown = {};
    switch (requestBody.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
          id: 'shellyplugsg3-e2e',
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
            apower: relayOn ? 42.3 : 0,
            voltage: 230.1,
            current: relayOn ? 0.2 : 0,
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
        result = {
          methods: [
            'PLUGS_UI.GetConfig',
            'PLUGS_UI.SetConfig',
            'Cloud.GetConfig',
            'Cloud.SetConfig',
            'Cloud.GetStatus'
          ]
        };
        break;
      case 'PLUGS_UI.GetConfig':
        result = {
          leds: {
            mode: 'switch',
            colors: {
              'switch:0': {
                on: { rgb: [0, 100, 0], brightness: 100 },
                off: { rgb: [100, 0, 0], brightness: 75 }
              },
              power: { brightness: 80 }
            },
            night_mode: {
              enable: true,
              brightness: 10,
              active_between: ['22:00', '06:00']
            }
          },
          controls: { 'switch:0': { in_mode: 'momentary' } }
        };
        break;
      case 'Cloud.GetConfig':
        result = { enable: false, server: 'shelly-195-eu.shelly.cloud:6022/jrpc' };
        break;
      case 'Cloud.GetStatus':
        result = { connected: false };
        break;
      case 'Script.GetCode':
        result = { data: '// Local Climate Link deployed script\nprint("ok");' };
        break;
      case 'Script.GetStatus':
        result = {
          id: 1,
          running: scriptRunning,
          mem_used: 2048,
          mem_peak: 3072,
          mem_free: 4096,
          cpu: 1.5
        };
        break;
      case 'Sys.GetStatus':
        result = { ram_free: 64000, ram_size: 262144 };
        break;
      case 'Script.List':
        result = {
          scripts: [
            {
              id: 1,
              name: 'Local Climate Link Thermostat',
              enable: true,
              running: scriptRunning
            }
          ]
        };
        break;
      case 'Script.Eval': {
        const code = requestBody.params?.code ?? '';
        if (code.includes('R.m=1')) {
          runtimeMode = 1;
        } else if (code.includes('R.m=0')) {
          runtimeMode = 0;
        }
        result = { result: String(runtimeMode) };
        break;
      }
      case 'Script.Stop':
        scriptRunning = false;
        result = null;
        break;
      case 'Script.Start':
        scriptRunning = true;
        result = null;
        break;
      case 'Switch.Set':
        relayOn = requestBody.params?.on ?? false;
        result = null;
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

  await page.route('**/__lcl_shelly_proxy?**', handleRpc);
  await page.route('http://192.168.0.20/rpc', handleRpc);
};

const mockTimeShellyRpc = async (page: Page) => {
  let relayOn = false;
  let rev = 0;
  let nextJobId = 7;
  let jobs: Array<{
    id: number;
    enable: boolean;
    timespec: string;
    calls: Array<{ method: string; params?: Record<string, unknown> }>;
  }> = [];
  const state = { createCount: 0, updateCount: 0, deleteCount: 0 };

  const handleRpc = async (route: Route) => {
    const requestBody = JSON.parse(route.request().postData() ?? '{}') as {
      id?: number | string;
      method?: string;
      params?: {
        id?: number;
        on?: boolean;
        enable?: boolean;
        timespec?: string;
        calls?: Array<{ method: string; params?: Record<string, unknown> }>;
      };
    };

    let result: unknown = {};
    switch (requestBody.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
          id: 'shellyplugsg3-time-e2e',
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
            apower: relayOn ? 42.3 : 0,
            voltage: 230.1,
            current: relayOn ? 0.2 : 0,
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
      case 'Script.List':
        result = { scripts: [] };
        break;
      case 'Schedule.List':
        result = { jobs: structuredClone(jobs), rev };
        break;
      case 'Schedule.Create': {
        const params = requestBody.params;
        if (!params?.timespec || !params.calls) {
          throw new Error('Invalid Schedule.Create fixture.');
        }
        const id = nextJobId++;
        state.createCount += 1;
        rev += 1;
        jobs.push({
          id,
          enable: params.enable ?? true,
          timespec: params.timespec,
          calls: structuredClone(params.calls)
        });
        result = { id, rev };
        break;
      }
      case 'Schedule.Update': {
        const id = requestBody.params?.id;
        const index = jobs.findIndex((job) => job.id === id);
        if (index < 0) {
          throw new Error(`Unknown Schedule.Update id ${String(id)}.`);
        }
        const current = jobs[index]!;
        jobs[index] = {
          ...current,
          ...(requestBody.params?.enable === undefined
            ? {}
            : { enable: requestBody.params.enable }),
          ...(requestBody.params?.timespec === undefined
            ? {}
            : { timespec: requestBody.params.timespec }),
          ...(requestBody.params?.calls === undefined
            ? {}
            : { calls: structuredClone(requestBody.params.calls) })
        };
        state.updateCount += 1;
        rev += 1;
        result = { rev };
        break;
      }
      case 'Schedule.Delete':
        jobs = jobs.filter((job) => job.id !== requestBody.params?.id);
        state.deleteCount += 1;
        rev += 1;
        result = { rev };
        break;
      case 'Switch.Set':
        relayOn = requestBody.params?.on ?? false;
        result = null;
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

  await page.route('**/__lcl_shelly_proxy?**', handleRpc);
  await page.route('http://192.168.0.20/rpc', handleRpc);
  return state;
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

        if (!hasSize || allowsHorizontalScroll || !leavesViewport) {
          return null;
        }

        return {
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

const ensureRuleAdvancedOpen = async (page: Page) => {
  const summary = page.locator('summary').filter({ hasText: 'Zaawansowane' });
  const details = summary.locator('xpath=..');
  if ((await details.getAttribute('open')) === null) {
    await summary.click();
  }
};

const expectNoLegacyInlineFeedback = async (page: Page) => {
  const offenders = await page.evaluate(() => {
    const legacyBoxes = Array.from(
      document.querySelectorAll<HTMLElement>('.warning-box, .notice-box')
    ).map((element) => ({
      className: element.className.toString(),
      text: element.textContent?.trim().slice(0, 80) ?? ''
    }));
    const inlineLiveRegions = Array.from(
      document.querySelectorAll<HTMLElement>('[role="alert"], [role="status"]')
    )
      .filter((element) => !element.closest('.lcl-toast-viewport'))
      .map((element) => ({
        role: element.getAttribute('role'),
        className: element.className.toString(),
        text: element.textContent?.trim().slice(0, 80) ?? ''
      }));

    return { legacyBoxes, inlineLiveRegions };
  });

  expect(offenders.legacyBoxes).toEqual([]);
  expect(offenders.inlineLiveRegions).toEqual([]);
};

const requiredBox = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

const expectClimateDetailHierarchy = async (page: Page) => {
  const [tabsBox, surfaceBox] = await Promise.all([
    requiredBox(page.locator('.plug-detail-tabs')),
    requiredBox(page.locator('.plug-detail-surface'))
  ]);

  expect(tabsBox.width).toBeGreaterThan(0);
  expect(surfaceBox.width).toBeGreaterThan(0);
  expect(Math.abs(tabsBox.x - surfaceBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(tabsBox.width - surfaceBox.width)).toBeLessThanOrEqual(2);
  await expect(page.locator('.app-page-back-row')).toHaveCount(0);
  await expect(page.locator('.installation-detail-live')).toHaveCount(0);
  await expect(page.locator('.app-bottom-nav')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Gniazdka', exact: true })
  ).toHaveAttribute('aria-current', 'page');
};

const expectTimeDetailHierarchy = async (page: Page) => {
  const [gridBox, liveBox, refreshBox] = await Promise.all([
    requiredBox(page.locator('.installation-detail-grid')),
    requiredBox(page.locator('.installation-detail-live')),
    requiredBox(
      page.locator('.installation-detail-header').getByRole('button', { name: 'Odśwież' })
    )
  ]);

  expect(Math.abs(liveBox.x - gridBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(liveBox.width - gridBox.width)).toBeLessThanOrEqual(2);
  expect(refreshBox.width).toBeLessThanOrEqual(48);
  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toHaveCount(0);
};

const expectScriptPreviewFillsModalBody = async (page: Page, label: string) => {
  const metrics = await page.getByLabel(label).evaluate((element) => {
    const modal = element.closest('.lcl-modal');
    const body = element.closest('.lcl-modal__body');
    const code = element.querySelector('.lcl-script-preview__code');
    const previewRect = element.getBoundingClientRect();
    const bodyRect = body?.getBoundingClientRect();
    const codeRect = code?.getBoundingClientRect();

    return {
      bodyHeight: bodyRect?.height ?? 0,
      codeHeight: codeRect?.height ?? 0,
      modalClassName: modal?.className.toString() ?? '',
      previewHeight: previewRect.height
    };
  });

  expect(metrics.modalClassName).toBe('lcl-modal');
  expect(metrics.previewHeight).toBeGreaterThan(metrics.bodyHeight * 0.85);
  expect(metrics.codeHeight).toBeGreaterThan(metrics.bodyHeight * 0.7);
};

const seedInstalledAutomation = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'lcl.installedAutomations.v1',
      JSON.stringify({
        version: 1,
        installations: [
          {
            version: 1,
            id: 'climate:shellyplugsg3-e2e:0',
            kind: 'climate',
            shelly: {
              deviceId: 'shellyplugsg3-e2e',
              name: 'Salon',
              baseUrl: 'http://192.168.0.20/',
              model: 'S3PL-00112EU',
              gen: 3
            },
            script: { id: 1, hash: 'lcl-e2e' },
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
                vpdAssist: { enabled: true, targetKpa: 1.2 },
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
          }
        ]
      })
    );
  });
};

for (const viewport of viewports) {
  test(`installed automation dashboard shows Shelly runtime on ${viewport.name}`, async ({
    page
  }) => {
    const consoleProblems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleProblems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => consoleProblems.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedInstalledAutomation(page);
    await mockShellyRpc(page);
    await page.goto('/');

    await expect(page.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gniazdka' })).toHaveCount(0);
    await expect(page.getByText('Salon')).toBeVisible();
    await expect(page.getByText('21.4°C')).toBeVisible();
    await expect(page.getByText('55.2%')).toBeVisible();
    await expect(page.getByText('1.31 → 1.20 kPa')).toBeVisible();
    await expect(page.getByText('Działa')).toHaveCount(0);
    await expect(page.getByText('ON 19°C · OFF 20°C')).toBeVisible();
    await expect(page.getByRole('button', { name: 'AUTO', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'MANUAL', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Odśwież' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dodaj automatykę' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Szczegóły: Salon' }).click();
    await expect(page.getByRole('navigation', { name: 'Akcje gniazdka' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Salon' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Automatyka' })).toHaveCount(0);
    await expect(page.getByText('Powód automatyzacji')).toBeVisible();
    await expect(page.getByText('Wyjście automatyzacji')).toBeVisible();
    await expect(page.getByText('Stan przekaźnika')).toBeVisible();
    await expect(page.getByText('Przedpokój')).toBeVisible();
    await expect(page.getByText('Zakres pracy: 19–20°C · Temperatura')).toBeVisible();
    await expect(
      page.locator('details.rule-advanced-disclosure.lcl-disclosure')
    ).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'AUTO', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'MANUAL', exact: true })).toHaveCount(
      0
    );

    await page.getByRole('button', { name: 'Bluetooth' }).click();
    await expect(page.getByText('91%')).toBeVisible();
    await expect(page.getByText('-51 dBm')).toBeVisible();

    await page.getByRole('button', { name: 'Ustawienia gniazdka' }).click();
    await expect(page.getByRole('heading', { name: 'LED gniazdka' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tryb LED' })).toBeVisible();
    await expect(page.getByText('ON', { exact: true })).toBeVisible();
    await expect(page.getByText('OFF', { exact: true })).toBeVisible();
    await expect(page.locator('input[type="color"]')).toHaveCount(0);
    const onStateBox = await requiredBox(page.locator('fieldset.plug-led-state').nth(0));
    const offStateBox = await requiredBox(page.locator('fieldset.plug-led-state').nth(1));
    expect(offStateBox.y).toBeGreaterThan(onStateBox.y + onStateBox.height);
    const [nightStartBox, nightEndBox] = await Promise.all([
      requiredBox(page.getByLabel('Początek')),
      requiredBox(page.getByLabel('Koniec'))
    ]);
    expect(Math.abs(nightStartBox.y - nightEndBox.y)).toBeLessThanOrEqual(2);
    await expect(
      page.getByRole('button', { name: 'Zapisz ustawienia LED' })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Informacje' }).click();
    await expect(page.getByText('S3PL-00112EU, gen 3')).toBeVisible();
    await expect(page.getByText('0.20 A')).toBeVisible();
    await expect(page.getByText('32.4°C')).toBeVisible();
    await expect(page.getByText('42.3 W')).toHaveCount(0);
    await expect(page.getByText('230 V')).toHaveCount(0);
    await expectClimateDetailHierarchy(page);
    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);
    expect(consoleProblems).toEqual([]);
  });
}

test('installed automation dashboard safely switches AUTO and MANUAL on phone', async ({
  page
}) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await seedInstalledAutomation(page);
  await mockShellyRpc(page);
  await page.goto('/');

  const auto = page.getByRole('button', { name: 'AUTO', exact: true });
  const manual = page.getByRole('button', { name: 'MANUAL', exact: true });
  const off = page.getByRole('button', { name: 'OFF', exact: true });
  await expect(auto).toHaveAttribute('aria-pressed', 'true');

  await manual.click();
  await expect(manual).toHaveAttribute('aria-pressed', 'true');
  await expect(off).toHaveAttribute('aria-pressed', 'true');

  await auto.click();
  await expect(auto).toHaveAttribute('aria-pressed', 'true');

  await expectNoHorizontalOverflow(page);
  await expectNoLegacyInlineFeedback(page);
  expect(consoleProblems).toEqual([]);
});

for (const viewport of viewports) {
  test(`daily time automation installs and renders on ${viewport.name}`, async ({
    page
  }) => {
    const consoleProblems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleProblems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => consoleProblems.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedTimeDraft(page);
    const rpcState = await mockTimeShellyRpc(page);
    await page.goto('/');

    const plugCard = page
      .getByText('Shelly Plug S Gen3', { exact: true })
      .locator('xpath=ancestor::article[1]');
    await plugCard.getByRole('button', { name: 'Dodaj automatykę' }).click();
    await expect(page.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    await page.getByRole('button', { name: /Sterować według czasu/ }).click();

    await expect(page.getByRole('navigation', { name: 'Menu konfiguracji' })).toHaveCount(
      0
    );
    await expect(
      page.getByRole('heading', { name: 'Ustaw godziny ON i OFF' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Włącz o: 08:00' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wyłącz o: 20:00' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Zapisz harmonogram w Shelly' }).click();
    await expect(page.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    await expect(page.getByText('Harmonogram dzienny')).toBeVisible();
    await expect(page.getByText('08:00')).toBeVisible();
    await expect(page.getByText('20:00')).toBeVisible();
    await expect(page.getByText('Działa')).toBeVisible();
    expect(rpcState.createCount).toBe(2);

    const timeCard = page
      .getByRole('heading', { name: 'Shelly Plug S Gen3' })
      .locator('xpath=ancestor::article[1]');
    await timeCard.getByRole('button', { name: 'Szczegóły' }).click();
    await expect(page.getByRole('heading', { name: 'Shelly Plug S Gen3' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Harmonogram' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Gniazdka', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('button', { name: 'Ustawienia', exact: true })
    ).toBeVisible();
    await expect(page.getByText('Natywny Shelly Schedule')).toBeVisible();
    await expectTimeDetailHierarchy(page);
    await expectNoHorizontalOverflow(page);
    expect(consoleProblems).toEqual([]);
  });
}

test('daily time automation completes pause, resume, edit and delete lifecycle', async ({
  page
}) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await seedTimeDraft(page);
  const rpcState = await mockTimeShellyRpc(page);
  await page.goto('/');

  const plugCard = page
    .getByText('Shelly Plug S Gen3', { exact: true })
    .locator('xpath=ancestor::article[1]');
  await plugCard.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await page.getByRole('button', { name: /Sterować według czasu/ }).click();
  await page.getByRole('button', { name: 'Zapisz harmonogram w Shelly' }).click();
  const timeCard = page
    .getByRole('heading', { name: 'Shelly Plug S Gen3' })
    .locator('xpath=ancestor::article[1]');
  await timeCard.getByRole('button', { name: 'Szczegóły' }).click();

  await page.getByRole('button', { name: 'Wstrzymaj automatykę' }).click();
  await expect(
    page.getByText('Harmonogram wstrzymany, wyjście potwierdzone jako OFF.')
  ).toBeVisible();
  await expect(page.getByText('Wstrzymana')).toBeVisible();
  await expect(page.getByText('OFF', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Wznów automatykę' }).click();
  await expect(
    page.getByText('Harmonogram wznowiony i stan wyjścia dopasowany do bieżącej godziny.')
  ).toBeVisible();
  await expect(page.getByText('Działa')).toBeVisible();

  await page.getByRole('button', { name: 'Edytuj' }).click();
  await expect(page.getByRole('heading', { name: 'Edytuj godziny' })).toBeVisible();

  await page.getByRole('button', { name: 'Włącz o: 08:00' }).click();
  let picker = page.getByRole('dialog', { name: 'Włącz o' });
  await picker.getByRole('button', { name: 'HH 06' }).click();
  await picker.getByRole('button', { name: 'MM 30' }).click();
  await picker.getByRole('button', { name: 'Wybierz' }).click();

  await page.getByRole('button', { name: 'Wyłącz o: 20:00' }).click();
  picker = page.getByRole('dialog', { name: 'Wyłącz o' });
  await picker.getByRole('button', { name: 'HH 22' }).click();
  await picker.getByRole('button', { name: 'MM 15' }).click();
  await picker.getByRole('button', { name: 'Wybierz' }).click();

  await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.getByRole('heading', { name: 'Shelly Plug S Gen3' })).toBeVisible();
  await expect(page.getByText('06:30')).toBeVisible();
  await expect(page.getByText('22:15')).toBeVisible();

  await page.getByRole('button', { name: 'Usuń automatykę czasową' }).click();
  const deleteDialog = page.getByRole('dialog', { name: 'Usunąć automatykę czasową?' });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Potwierdź usuń' }).click();
  await expect(page.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
  const plainPlugCard = page
    .getByText('Shelly Plug S Gen3', { exact: true })
    .locator('xpath=ancestor::article[1]');
  await expect(
    plainPlugCard.getByRole('button', { name: 'Dodaj automatykę' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Gniazdka', exact: true })
  ).toHaveAttribute('aria-current', 'page');

  expect(rpcState.createCount).toBe(2);
  expect(rpcState.updateCount).toBeGreaterThanOrEqual(6);
  expect(rpcState.deleteCount).toBe(2);
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([]);
});

for (const viewport of viewports) {
  test(`current Plug setup routes have no horizontal overflow on ${viewport.name}`, async ({
    page
  }) => {
    const consoleProblems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        consoleProblems.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => consoleProblems.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedDraft(page);
    await mockShellyRpc(page);
    await page.goto('/');

    await expect(page).toHaveTitle('Local Climate Link');
    await expect(page.getByRole('main', { name: 'Gniazdka' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Gniazdka', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Dodaj gniazdko', exact: true }).click();
    await expect(page.getByRole('tablist', { name: 'Dodaj gniazdko' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Skanuj sieć' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Dodaj ręcznie' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menu konfiguracji' })).toHaveCount(
      0
    );
    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);

    await page.getByRole('button', { name: 'Gniazdka', exact: true }).click();
    const plugCard = page
      .getByText('Shelly Plug S Gen3', { exact: true })
      .locator('xpath=ancestor::article[1]');
    await plugCard.getByRole('button', { name: 'Dodaj automatykę' }).click();
    await expect(page.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
    await page.getByRole('button', { name: /Sterować temperaturą/ }).click();

    await expect(page.getByRole('navigation', { name: 'Menu konfiguracji' })).toHaveCount(
      0
    );
    await expect(page.getByLabel('VPD assist')).toBeVisible();
    await ensureRuleAdvancedOpen(page);
    await expect(page.getByRole('button', { name: 'Shelly Script' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);
    expect(consoleProblems).toEqual([]);
  });
}

test('rule page switches humidity modes, enables VPD assist, and copies the generated script', async ({
  page
}) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => consoleProblems.push(error.message));
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: e2eOrigin
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await seedDraft(page);
  await mockShellyRpc(page);
  await page.goto('/admin#rule');
  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await page.getByRole('button', { name: /Sterować wilgotnością/ }).click();
  await expect(page.getByRole('navigation', { name: 'Menu konfiguracji' })).toHaveCount(
    0
  );
  await ensureRuleAdvancedOpen(page);
  await expect(page.getByRole('button', { name: 'Shelly Script' })).toBeVisible();

  await page.getByRole('button', { name: 'Tryb reguły' }).click();
  await page.getByRole('option', { name: 'Nawilżanie' }).click();

  const onThreshold = page.getByLabel('Włącz poniżej %');
  const offThreshold = page.getByLabel('Wyłącz powyżej %');
  await expect(onThreshold).toHaveValue('45');
  await expect(offThreshold).toHaveValue('55');

  await onThreshold.fill('65');
  await expect(offThreshold).toHaveValue('55');
  await expect(
    page.getByText('Próg włączenia musi być niższy niż próg wyłączenia.')
  ).toBeVisible();

  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 412) {
    const [onThresholdBox, offThresholdBox] = await Promise.all([
      requiredBox(onThreshold),
      requiredBox(offThreshold)
    ]);
    expect(offThresholdBox.y).toBeGreaterThan(
      onThresholdBox.y + onThresholdBox.height - 1
    );
    expect(Math.abs(offThresholdBox.x - onThresholdBox.x)).toBeLessThanOrEqual(2);
  }
  await expectNoHorizontalOverflow(page);

  await onThreshold.fill('45');
  await expect(
    page.getByText('Próg włączenia musi być niższy niż próg wyłączenia.')
  ).toHaveCount(0);
  const summaryTrigger = page.getByRole('button', { name: 'Podsumowanie reguły' });
  await summaryTrigger.click();
  let summaryPopover = page.getByRole('tooltip', { name: 'Podsumowanie reguły' });
  await expect(
    summaryPopover.getByText(/Nawilżanie włączy się poniżej 45\.0%/)
  ).toBeVisible();
  await summaryTrigger.click();
  await page.getByRole('button', { name: 'Shelly Script' }).click();
  let scriptDialog = page.getByRole('dialog', { name: 'Shelly Script' });
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"m":1');
  await scriptDialog.getByRole('button', { name: 'Zamknij' }).click();

  await page.getByRole('button', { name: 'Tryb reguły' }).click();
  await page.getByRole('option', { name: 'Osuszanie' }).click();

  await expect(page.getByLabel('Włącz powyżej %')).toHaveValue('65');
  await expect(page.getByLabel('Wyłącz poniżej %')).toHaveValue('55');
  await summaryTrigger.click();
  summaryPopover = page.getByRole('tooltip', { name: 'Podsumowanie reguły' });
  await expect(
    summaryPopover.getByText(/Osuszanie włączy się powyżej 65\.0%/)
  ).toBeVisible();
  await summaryTrigger.click();
  await page.getByRole('button', { name: 'Shelly Script' }).click();
  scriptDialog = page.getByRole('dialog', { name: 'Shelly Script' });
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"m":1');
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"d":1');
  await scriptDialog.getByRole('button', { name: 'Zamknij' }).click();

  await page.getByLabel('VPD assist').check();
  await page.getByLabel('Docelowe VPD kPa').fill('1.25');
  await ensureRuleAdvancedOpen(page);
  await expect(page.getByRole('dialog', { name: 'Opcje zaawansowane' })).toHaveCount(0);
  await expect(page.getByLabel('Minimalny RSSI dBm')).toHaveValue('-85');
  await expect(page.getByLabel('Brak odczytu przez min')).toHaveValue('2');
  await expect(page.getByLabel('Ponowne ON po min')).toHaveValue('2');
  await page.getByLabel('Minimalny RSSI dBm').fill('-80');
  await page.getByLabel('Brak odczytu przez min').fill('10');
  await page.getByLabel('Ponowne ON po min').fill('3');
  await page.getByLabel('Maksymalny czas pracy h').fill('3');
  await summaryTrigger.click();
  summaryPopover = page.getByRole('tooltip', { name: 'Podsumowanie reguły' });
  await expect(
    summaryPopover.getByText(/VPD assist uwzględni cel 1\.25 kPa/)
  ).toBeVisible();
  await expect(
    summaryPopover.getByText(/Ponowne ON najwcześniej po 3 min/)
  ).toBeVisible();
  await expect(
    summaryPopover.getByText(/Sygnał termometru musi mieć co najmniej -80 dBm/)
  ).toBeVisible();
  await summaryTrigger.click();

  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Shelly Script' }).click();
  scriptDialog = page.getByRole('dialog', { name: 'Shelly Script' });
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"vp":1.25');
  await expectScriptPreviewFillsModalBody(page, 'Wygenerowany skrypt');
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"r":-80');
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText(
    '"s":600000'
  );
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText(
    '"c":180000'
  );
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText(
    '"x":10800000'
  );
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText(
    'Shelly.getUptimeMs'
  );
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).not.toContainText(
    'Date.now'
  );
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText(
    'function sv(t)'
  );

  await scriptDialog.getByRole('button', { name: 'Kopiuj skrypt' }).click();

  await expect(page.getByText('Skopiowano skrypt.')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('m: climate-engine-v1');
  expect(consoleProblems).toEqual([]);
});

test('keeps app toasts anchored above bottom navigation at every viewport', async ({
  page
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: e2eOrigin
  });
  await seedDraft(page);
  await mockShellyRpc(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin#rule');
  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await page.getByRole('button', { name: /Sterować wilgotnością/ }).click();
  await ensureRuleAdvancedOpen(page);
  await expect(page.getByRole('button', { name: 'Shelly Script' })).toBeVisible();

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.getByRole('button', { name: 'Shelly Script' }).click();

    const scriptDialog = page.getByRole('dialog', { name: 'Shelly Script' });
    await scriptDialog.getByRole('button', { name: 'Kopiuj skrypt' }).click();
    await expect(page.getByText('Skopiowano skrypt.')).toBeVisible();
    await scriptDialog.getByRole('button', { name: 'Zamknij' }).click();

    const toastViewport = page.locator('.lcl-toast-viewport');
    await expect(toastViewport).toBeVisible();
    await expect(page.locator('#app-toast-host > .lcl-toast-viewport')).toHaveCount(1);
    await expect(
      page.locator('.app-root-shell__content .lcl-toast-viewport')
    ).toHaveCount(0);

    const geometry = await page.evaluate(() => {
      const toast = document.querySelector<HTMLElement>('.lcl-toast-viewport');
      const nav = document.querySelector<HTMLElement>('.app-bottom-nav');
      if (!toast || !nav) return null;
      const toastRect = toast.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      return {
        toastBottom: toastRect.bottom,
        toastLeft: toastRect.left,
        toastRight: toastRect.right,
        navTop: navRect.top,
        viewportWidth: window.innerWidth
      };
    });

    expect(geometry).not.toBeNull();
    const gap = geometry!.navTop - geometry!.toastBottom;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(16);
    expect(geometry!.toastLeft).toBeGreaterThanOrEqual(0);
    expect(geometry!.toastRight).toBeLessThanOrEqual(geometry!.viewportWidth);

    const screenshotDir = process.env.LCL_TOAST_SCREENSHOT_DIR;
    if (screenshotDir) {
      await page.screenshot({
        path: `${screenshotDir}/toast-${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: false
      });
    }

    await page.locator('.lcl-toast__dismiss').click();
    await expect(page.locator('.lcl-toast-viewport')).toHaveCount(0);
  }
});
