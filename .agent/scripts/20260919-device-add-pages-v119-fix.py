from pathlib import Path

ROOT = Path('.')

def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')

shelly = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    shelly,
    "import { InfoPopover, Modal, ToastViewport } from '@lcl/ui';",
    "import { InfoLabel, Modal, ToastViewport } from '@lcl/ui';",
)
replace(
    shelly,
    """          <div className=\"installation-section-heading\">
            <h1>{t('hardware.shelly.add')}</h1>
            <InfoPopover
              label={t('hardware.shelly.infoScanLabel')}
              title={t('hardware.shelly.infoScanTitle')}
            >
              {shellyScanEstimate}
              <br />
              <br />
              {t('hardware.shelly.scannerBehavior')}
            </InfoPopover>
          </div>""",
    """          <div className=\"installation-section-heading\">
            <h1>{t('hardware.shelly.add')}</h1>
          </div>""",
)
replace(
    shelly,
    """            <div className=\"shelly-network-scan__body\">""",
    """            <div className=\"shelly-network-scan__body\">
              <p className=\"device-add-page__hint\">
                <InfoLabel
                  label={shellyScanEstimate}
                  infoLabel={t('hardware.shelly.infoScanLabel')}
                  title={t('hardware.shelly.infoScanTitle')}
                >
                  {t('hardware.shelly.scannerBehavior')}
                </InfoLabel>
              </p>""",
)

test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace(
    test,
    "    expect(tooltipButton.closest('.installation-section-heading')).not.toBeNull();\n    expect(tooltipButton.closest('.shelly-network-scan__body')).toBeNull();",
    "    expect(tooltipButton.closest('.device-add-page__hint')).not.toBeNull();\n    expect(tooltipButton.closest('.shelly-network-scan__body')).not.toBeNull();",
)

print('Device add page InfoLabel fix applied')
