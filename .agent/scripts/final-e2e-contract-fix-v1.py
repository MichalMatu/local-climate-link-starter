from pathlib import Path

path = Path('apps/mobile/e2e/responsive.spec.ts')
source = path.read_text()

old_helper = """const expectDetailHierarchy = async (page: Page) => {
  const [gridBox, liveBox, headerBox, refreshBox] = await Promise.all([
    requiredBox(page.locator('.installation-detail-grid')),
    requiredBox(page.locator('.installation-detail-live')),
    requiredBox(page.locator('.installation-detail-header')),
    requiredBox(
      page.locator('.installation-detail-header').getByRole('button', { name: 'Odśwież' })
    )
  ]);

  expect(Math.abs(liveBox.x - gridBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(liveBox.width - gridBox.width)).toBeLessThanOrEqual(2);
  expect(refreshBox.width).toBeLessThanOrEqual(48);
  expect(Math.abs(refreshBox.y - headerBox.y)).toBeLessThanOrEqual(2);
  expect(
    Math.abs(refreshBox.x + refreshBox.width - (headerBox.x + headerBox.width))
  ).toBeLessThanOrEqual(2);
};
"""
new_helper = """const expectClimateDetailHierarchy = async (page: Page) => {
  const [gridBox, liveBox] = await Promise.all([
    requiredBox(page.locator('.installation-detail-grid')),
    requiredBox(page.locator('.installation-detail-live'))
  ]);

  expect(Math.abs(liveBox.x - gridBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(liveBox.width - gridBox.width)).toBeLessThanOrEqual(2);
  await expect(page.locator('.installation-detail-header .detail-back-link')).toHaveCount(0);
  await expect(page.locator('.installation-detail-header .runtime-refresh-action')).toHaveCount(0);
  await expect(page.locator('.app-bottom-nav')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Klimat' })).toHaveAttribute(
    'aria-current',
    'page'
  );
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
  await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toBeVisible();
};
"""
assert old_helper in source
source = source.replace(old_helper, new_helper, 1)

old_dashboard = """    await expect(page.getByText('Działa')).toBeVisible();
    await expect(page.getByText('19°C / 20°C')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Odśwież' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dodaj automatykę' })).toBeVisible();
    await page.getByRole('button', { name: 'Szczegóły' }).click();
    await expect(page.getByRole('heading', { name: 'Salon' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Klimat teraz' })).toBeVisible();
    await expect(page.getByText('21.4°C')).toBeVisible();
    await expect(page.getByText('55.2%')).toBeVisible();
    await expect(page.getByText('1.31 kPa')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Wstrzymaj automatykę' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Wróć do automatyk/ })).toBeVisible();
    await expectDetailHierarchy(page);
"""
new_dashboard = """    await expect(page.getByText('Działa')).toHaveCount(0);
    await expect(page.getByText('19°C / 20°C')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Odśwież' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dodaj automatykę' })).toBeVisible();
    await page.getByRole('button', { name: 'Szczegóły: Salon' }).click();
    await expect(page.getByRole('heading', { name: 'Salon' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Klimat teraz' })).toBeVisible();
    await expect(page.getByText('21.4°C')).toBeVisible();
    await expect(page.getByText('55.2%')).toBeVisible();
    await expect(page.getByText('1.31 kPa')).toBeVisible();
    await expect(page.getByRole('button', { name: 'AUTO' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('button', { name: 'MANUAL' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Wróć do automatyki/ })).toHaveCount(0);
    await expectClimateDetailHierarchy(page);
"""
assert old_dashboard in source
source = source.replace(old_dashboard, new_dashboard, 1)

old_pause = """  await page.getByRole('button', { name: 'Szczegóły' }).click();
  await expect(page.getByRole('heading', { name: 'Salon' })).toBeVisible();
  await expect(page.getByText('Działa')).toBeVisible();

  await page.getByRole('button', { name: 'Wstrzymaj automatykę' }).click();
  await expect(
    page.getByText('Automatyka zatrzymana, wyjście potwierdzone jako OFF.')
  ).toBeVisible();
  await expect(page.getByText('Wstrzymana')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Uruchom automatykę' })).toBeVisible();
  await expect(page.getByText('OFF', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Uruchom automatykę' }).click();
  await expect(page.getByText('Automatyka uruchomiona.')).toBeVisible();
  await expect(page.getByText('Działa')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wstrzymaj automatykę' })).toBeVisible();
"""
new_pause = """  await page.getByRole('button', { name: 'Szczegóły: Salon' }).click();
  await expect(page.getByRole('heading', { name: 'Salon' })).toBeVisible();
  const auto = page.getByRole('button', { name: 'AUTO' });
  const manual = page.getByRole('button', { name: 'MANUAL' });
  await expect(auto).toHaveAttribute('aria-pressed', 'true');

  await manual.click();
  await expect(
    page.getByText('Automatyka zatrzymana, wyjście potwierdzone jako OFF.')
  ).toBeVisible();
  await expect(manual).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('OFF', { exact: true })).toBeVisible();

  await auto.click();
  await expect(page.getByText('Automatyka uruchomiona.')).toBeVisible();
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
"""
assert old_pause in source
source = source.replace(old_pause, new_pause, 1)

source = source.replace('    await expectDetailHierarchy(page);', '    await expectTimeDetailHierarchy(page);', 1)

old_delete = """  await expect(page.getByRole('heading', { name: 'Twoje automatyki' })).toBeVisible();
  await expect(page.getByText('Nie masz jeszcze zapisanej automatyki')).toBeVisible();
"""
new_delete = """  await expect(page.getByRole('heading', { name: 'Co chcesz zrobić?' })).toBeVisible();
  await expect(page.getByText('Nie masz jeszcze zapisanej automatyki')).toHaveCount(0);
"""
assert old_delete in source
source = source.replace(old_delete, new_delete, 1)

assert 'expectDetailHierarchy' not in source
path.write_text(source)
print('responsive E2E contract aligned with current UI')
