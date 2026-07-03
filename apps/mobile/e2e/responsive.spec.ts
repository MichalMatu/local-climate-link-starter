import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

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

const viewports = [
  { name: 'phone-small', width: 360, height: 740 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
] as const;

const tabs = ['Shelly', 'Termometry', 'Reguła', 'Diag'] as const;

const seedDraft = async (page: Page) => {
  await page.addInitScript((value) => {
    window.localStorage.setItem('lcl.hardwareSetupDraft.v8', JSON.stringify(value));
  }, draft);
};

const mockShellyRpc = async (page: Page) => {
  const handleRpc = async (route: Route) => {
    const requestBody = JSON.parse(route.request().postData() ?? '{}') as {
      id?: number | string;
      method?: string;
    };
    let result: unknown = {};
    switch (requestBody.method) {
      case 'Shelly.GetDeviceInfo':
        result = {
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
        result = {
          scripts: [
            {
              id: 1,
              name: 'Local Climate Link Thermostat',
              enable: true,
              running: true
            }
          ]
        };
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

const expectRelayActionVisible = async (page: Page) => {
  const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');
  const relayAction = shellyControls.getByRole('button', { name: /^(ON|OFF)$/ });
  await expect(relayAction).toHaveCount(1);
  await expect(relayAction).toBeVisible();
};

const requiredBox = async (locator: Locator) => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
};

const expectActionButtonAlignedToActionEdge = async (button: Locator) => {
  const row = button.locator(
    'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " action-row ")][1]'
  );
  await expect(row).toHaveCount(1);

  const [buttonBox, rowBox] = await Promise.all([requiredBox(button), requiredBox(row)]);
  const buttonRight = Math.round(buttonBox.x + buttonBox.width);
  const rowRight = Math.round(rowBox.x + rowBox.width);

  expect(Math.abs(buttonRight - rowRight)).toBeLessThanOrEqual(2);
};

const expectModalFooterButtonsFillWidth = async (dialog: Locator) => {
  const metrics = await dialog.locator('.lcl-modal__footer').evaluate((footer) => {
    const footerRect = footer.getBoundingClientRect();
    return Array.from(footer.querySelectorAll<HTMLButtonElement>('button')).map(
      (button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.textContent?.trim() ?? '',
          widthDelta: Math.round(footerRect.width - rect.width)
        };
      }
    );
  });

  expect(metrics.length).toBeGreaterThan(0);
  for (const item of metrics) {
    expect(
      item.widthDelta,
      `${item.label} should fill the modal footer`
    ).toBeLessThanOrEqual(2);
  }
};

const expectShellyCardActionsLayout = async (page: Page) => {
  const settingsToggle = page.getByRole('button', { name: 'Ustawienia gniazdka' });
  await expect(settingsToggle).toBeVisible();
  await settingsToggle.click();
  const settingsDialog = page.getByRole('dialog', { name: 'Ustawienia gniazdka' });
  await expect(settingsDialog).toBeVisible();
  await expect(settingsDialog.getByText('Adres IP')).toBeVisible();
  await expect(settingsDialog.getByText('http://192.168.0.20/')).toBeVisible();
  await expect(settingsDialog.getByText('Firmware')).toBeVisible();
  await expect(settingsDialog.getByText('20260311-095902/1.7.5-g9979d16')).toBeVisible();
  await expect(settingsDialog.getByRole('button', { name: 'Skanuj BLE' })).toBeVisible();
  await expect(settingsDialog.getByRole('button', { name: 'Usuń' })).toBeVisible();
  await settingsDialog.getByRole('button', { name: 'Zamknij' }).click();

  const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');
  const boxes = await Promise.all([
    requiredBox(shellyControls.getByRole('button', { name: 'Odśwież' })),
    requiredBox(shellyControls.getByRole('button', { name: 'MANUAL' })),
    requiredBox(shellyControls.getByRole('button', { name: /^(ON|OFF)$/ }))
  ]);
  const topSpread =
    Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y));
  expect(topSpread).toBeLessThan(3);
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

  expect(metrics.modalClassName).toContain('lcl-modal--workspace');
  expect(metrics.previewHeight).toBeGreaterThan(metrics.bodyHeight * 0.85);
  expect(metrics.codeHeight).toBeGreaterThan(metrics.bodyHeight * 0.7);
};

for (const viewport of viewports) {
  test(`hardware setup has no horizontal overflow on ${viewport.name}`, async ({
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
    await page.goto('/admin#shelly');

    await expect(page).toHaveTitle('Local Climate Link');
    await expect(
      page.getByRole('navigation', { name: 'Menu konfiguracji' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Shelly', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('region', { name: 'Gniazdka Shelly' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dodaj gniazdko' })).toBeVisible();
    await expect(page.getByLabel('Dodane gniazdka')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);

    const shellyControls = page.getByLabel('Sterowanie Shelly Plug S Gen3');
    await expectRelayActionVisible(page);
    await expect(shellyControls.getByRole('button', { name: 'MANUAL' })).toBeVisible();
    await expect(shellyControls.getByRole('button', { name: 'Odśwież' })).toBeVisible();
    await expectShellyCardActionsLayout(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Dodaj gniazdko' }).click();
    const addShellyDialog = page.getByRole('dialog', { name: 'Dodaj gniazdko' });
    await expect(addShellyDialog).toBeVisible();
    const shellyNameInputBox = await addShellyDialog
      .getByLabel('Nazwa gniazdka')
      .boundingBox();
    expect(shellyNameInputBox?.height).toBeLessThan(90);
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Zamknij' }).click();

    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      if (tab === 'Termometry') {
        await expect(
          page.getByRole('button', { name: 'Termometry', exact: true })
        ).toHaveAttribute('aria-current', 'page');
        await expect(page.getByRole('region', { name: 'Termometry BLE' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Dodaj termometr' })).toBeVisible();
        await page.getByRole('button', { name: 'Dodaj termometr' }).click();
        const addSensorDialog = page.getByRole('dialog', { name: 'Dodaj termometr' });
        await expect(addSensorDialog).toBeVisible();
        if (viewport.width <= 704) {
          await expectModalFooterButtonsFillWidth(addSensorDialog);
        }
        await expectNoHorizontalOverflow(page);
        await page.getByRole('button', { name: 'Zamknij' }).click();
      }
      if (tab === 'Diag') {
        const refreshDiagnosticsButton = page.getByRole('button', {
          name: 'Odśwież diagnostykę'
        });
        await expect(refreshDiagnosticsButton).toBeVisible();
        await expectActionButtonAlignedToActionEdge(refreshDiagnosticsButton);
      }
      await expectNoHorizontalOverflow(page);
      await expectNoLegacyInlineFeedback(page);
    }

    await page.getByRole('button', { name: 'Reguła' }).click();
    await page.getByRole('button', { name: 'Zaawansowane' }).click();
    await expect(page.getByRole('dialog', { name: 'Opcje zaawansowane' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoLegacyInlineFeedback(page);
    await page.getByRole('button', { name: 'Zamknij' }).click();
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
    origin: 'http://127.0.0.1:5173'
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await seedDraft(page);
  await mockShellyRpc(page);
  await page.goto('/admin#rule');

  await page.getByLabel('Tryb reguły').selectOption('humidifying');

  await expect(page.getByLabel('Włącz poniżej %')).toHaveValue('45');
  await expect(page.getByLabel('Wyłącz powyżej %')).toHaveValue('55');
  await expect(page.getByText(/Nawilżanie włączy się poniżej 45\.0%/)).toBeVisible();
  await page.getByRole('button', { name: 'Pokaż skrypt' }).click();
  let scriptDialog = page.getByRole('dialog', { name: 'Podgląd Shelly Script' });
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"m":1');
  await scriptDialog.getByRole('button', { name: 'Zamknij' }).click();

  await page.getByLabel('Tryb reguły').selectOption('dehumidifying');

  await expect(page.getByLabel('Włącz powyżej %')).toHaveValue('65');
  await expect(page.getByLabel('Wyłącz poniżej %')).toHaveValue('55');
  await expect(page.getByText(/Osuszanie włączy się powyżej 65\.0%/)).toBeVisible();
  await page.getByRole('button', { name: 'Pokaż skrypt' }).click();
  scriptDialog = page.getByRole('dialog', { name: 'Podgląd Shelly Script' });
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"m":1');
  await expect(scriptDialog.getByLabel('Wygenerowany skrypt')).toContainText('"d":1');
  await scriptDialog.getByRole('button', { name: 'Zamknij' }).click();

  await page.getByRole('button', { name: 'Zaawansowane' }).click();
  const advancedDialog = page.getByRole('dialog', { name: 'Opcje zaawansowane' });
  await expect(advancedDialog).toBeVisible();
  await expect(advancedDialog).toBeFocused();
  await expect(advancedDialog.getByLabel('Minimalny RSSI dBm')).not.toBeFocused();
  await expect(advancedDialog.getByLabel('Minimalny RSSI dBm')).toHaveValue('-85');
  await expect(advancedDialog.getByLabel('Brak odczytu przez min')).toHaveValue('2');
  await expect(advancedDialog.getByLabel('Ponowne ON po min')).toHaveValue('2');
  await advancedDialog.getByLabel('VPD assist').check();
  await advancedDialog.getByLabel('Docelowe VPD kPa').fill('1.25');
  await advancedDialog.getByLabel('Minimalny RSSI dBm').fill('-80');
  await advancedDialog.getByLabel('Brak odczytu przez min').fill('10');
  await advancedDialog.getByLabel('Ponowne ON po min').fill('3');
  await advancedDialog.getByLabel('Maksymalny czas pracy h').fill('3');
  await advancedDialog.getByRole('button', { name: 'Zastosuj' }).click();
  await expect(page.getByText(/VPD assist uwzględni cel 1\.25 kPa/)).toBeVisible();
  await expect(page.getByText(/Ponowne ON najwcześniej po 3 min/)).toBeVisible();
  await expect(
    page.getByText(/Sygnał termometru musi mieć co najmniej -80 dBm/)
  ).toBeVisible();

  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: 'Pokaż skrypt' }).click();
  scriptDialog = page.getByRole('dialog', { name: 'Podgląd Shelly Script' });
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
    .toContain('m: xiaomi-bthome-minimal');
  expect(consoleProblems).toEqual([]);
});
