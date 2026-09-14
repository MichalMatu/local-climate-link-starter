#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=09f3b7e2f9e945d228146bb971f9ffd6797b532b
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

cat > apps/mobile/e2e/responsive.spec.ts <<'EOF'
import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'phone-small', width: 360, height: 800 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-large', width: 412, height: 915 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
] as const;

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

const timeRule = {
  version: 1,
  id: 'time-e2e',
  kind: 'time',
  name: 'Światło dzienne',
  plugId: plug.id,
  relayId: 0,
  config: {
    schedule: {
      windows: [{ days: [0, 1, 2, 3, 4, 5, 6], start: '08:00', end: '20:00' }]
    }
  },
  deployment: null,
  createdAtMs: 3,
  updatedAtMs: 3
} as const;

const seedRegistries = async (page: Page) => {
  await page.addInitScript(
    ({ plugValue, sensorValue, rulesValue }) => {
      window.localStorage.setItem(
        'lcl.plugs.v1',
        JSON.stringify({ version: 1, items: [plugValue] })
      );
      window.localStorage.setItem(
        'lcl.sensors.v1',
        JSON.stringify({ version: 1, items: [sensorValue] })
      );
      window.localStorage.setItem(
        'lcl.rules.v1',
        JSON.stringify({ version: 1, items: rulesValue })
      );
    },
    { plugValue: plug, sensorValue: sensor, rulesValue: [climateRule, timeRule] }
  );
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
};

const collectConsoleProblems = (page: Page) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
};

for (const viewport of viewports) {
  test(`current product surfaces stay responsive on ${viewport.name}`, async ({ page }) => {
    const consoleProblems = collectConsoleProblems(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedRegistries(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
    await expect(page.getByText(climateRule.name)).toBeVisible();
    await expect(page.getByText(timeRule.name)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: new RegExp(climateRule.name) }).click();
    await expect(page.getByRole('heading', { name: climateRule.name })).toBeVisible();
    await expect(page.getByText(plug.name)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Gniazdka', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Gniazdka' })).toBeVisible();
    await expect(page.getByText(plug.name)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Termometry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Termometry' })).toBeVisible();
    await expect(page.getByText(sensor.name)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Ustawienia', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expectNoHorizontalOverflow(page);

    expect(consoleProblems).toEqual([]);
  });
}

test('climate rule editor opens from the current intent flow without legacy setup state', async ({
  page
}) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRegistries(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await expect(page.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  await page.getByRole('button', { name: /Sterować temperaturą/ }).click();
  await expect(page.getByRole('button', { name: 'Anuluj' })).toBeVisible();
  await expect(page.getByText(plug.name)).toBeVisible();
  await expect(page.getByText(sensor.name)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([]);
});

test('time rule editor opens from the current intent flow without legacy setup state', async ({
  page
}) => {
  const consoleProblems = collectConsoleProblems(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await seedRegistries(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Dodaj automatykę' }).click();
  await page.getByRole('button', { name: /Sterować według czasu/ }).click();
  await expect(page.getByRole('button', { name: 'Anuluj' })).toBeVisible();
  await expect(page.getByText(plug.name)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(consoleProblems).toEqual([]);
});
EOF

rm apps/mobile/e2e/led-settings.spec.ts

pnpm exec prettier --write apps/mobile/e2e/responsive.spec.ts

! git grep -nE 'lcl\.installedAutomations\.v1|seedInstalledAutomation|lcl\.hardwareSetupDraft\.v8' -- apps/mobile/e2e
! git grep -nE 'PLUGS_UI|LED gniazdka|hardware setup has no horizontal overflow' -- apps/mobile/e2e

git add apps/mobile/e2e/responsive.spec.ts apps/mobile/e2e/led-settings.spec.ts
pnpm precommit
pnpm e2e:responsive
pnpm --filter @lcl/mobile typecheck
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git commit -m "Migrate responsive E2E to rule registries"

git fetch origin "$BRANCH"
[[ "$(git rev-parse origin/$BRANCH)" == "$EXPECTED" ]] || { echo "Remote branch moved before push"; exit 5; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse HEAD)
[[ "$FINAL_HEAD" == "$(git rev-parse origin/$BRANCH)" ]] || { echo 'Push verification failed'; exit 6; }
echo "FINAL_HEAD=$FINAL_HEAD"
