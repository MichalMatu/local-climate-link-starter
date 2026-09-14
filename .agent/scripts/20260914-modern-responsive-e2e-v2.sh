#!/usr/bin/env bash
set -euo pipefail

git fetch origin agent-control
git show origin/agent-control:.agent/scripts/20260914-modern-responsive-e2e-v1.sh > /tmp/lcl-modern-responsive-e2e-v2-base.sh
python3 - <<'PY'
from pathlib import Path
path = Path('/tmp/lcl-modern-responsive-e2e-v2-base.sh')
text = path.read_text()
old_climate = """  await expect(page.getByRole('button', { name: 'Anuluj' })).toBeVisible();
  await expect(page.getByText(plug.name)).toBeVisible();
  await expect(page.getByText(sensor.name)).toBeVisible();
  await expectNoHorizontalOverflow(page);
"""
new_climate = """  await expect(page.getByRole('button', { name: 'Anuluj' })).toBeVisible();
  await expect(page.locator(`select option[value=\"${plug.id}\"]`)).toHaveText(plug.name);
  await expect(page.locator(`select option[value=\"${sensor.id}\"]`)).toHaveText(sensor.name);
  await expectNoHorizontalOverflow(page);
"""
old_time = """  await page.getByRole('button', { name: /Sterować według czasu/ }).click();
  await expect(page.getByRole('button', { name: 'Anuluj' })).toBeVisible();
  await expect(page.getByText(plug.name)).toBeVisible();
  await expectNoHorizontalOverflow(page);
"""
new_time = """  await page.getByRole('button', { name: /Sterować według czasu/ }).click();
  await expect(page.getByRole('button', { name: 'Anuluj' })).toBeVisible();
  await expect(page.locator(`select option[value=\"${plug.id}\"]`)).toHaveText(plug.name);
  await expectNoHorizontalOverflow(page);
"""
if old_climate not in text:
    raise SystemExit('Expected climate editor assertion block not found')
if old_time not in text:
    raise SystemExit('Expected time editor assertion block not found')
text = text.replace(old_climate, new_climate, 1).replace(old_time, new_time, 1)
path.write_text(text)
PY
bash /tmp/lcl-modern-responsive-e2e-v2-base.sh
