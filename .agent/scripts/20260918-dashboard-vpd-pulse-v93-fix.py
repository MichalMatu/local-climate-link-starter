from pathlib import Path

path = Path('apps/mobile/e2e/responsive.spec.ts')
text = path.read_text()
old = "    await expect(page.getByRole('button', { name: 'Dodaj automatykę' })).toBeVisible();\n"
new = "    await expect(page.getByRole('button', { name: 'Dodaj automatykę' })).toHaveCount(0);\n"
if old not in text:
    raise SystemExit('missing stale installed-dashboard add-automation assertion')
path.write_text(text.replace(old, new, 1))
print('Aligned installed dashboard E2E with plug-only add flow')
