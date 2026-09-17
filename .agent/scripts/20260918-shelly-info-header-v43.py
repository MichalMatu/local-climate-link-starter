from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


page = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = page.read_text()

s = replace_once(
    s,
    """      <Modal\n        busy={flow.checkShellyMutation.isPending}\n        closeLabel={t('common.close')}\n        open={isAddShellyModalOpen}\n        size=\"task\"\n        title={t('hardware.shelly.add')}\n        onClose={closeAddShellyModal}\n      >\n""",
    """      <Modal\n        busy={flow.checkShellyMutation.isPending}\n        closeLabel={t('common.close')}\n        headerActions={\n          <span className=\"shelly-network-scan__info\">\n            <InfoTooltip\n              label={t('hardware.shelly.infoScanLabel')}\n              title={t('hardware.shelly.infoScanTitle')}\n            >\n              {shellyScanEstimate}\n              <br />\n              <br />\n              {t('hardware.shelly.scannerBehavior')}\n            </InfoTooltip>\n          </span>\n        }\n        open={isAddShellyModalOpen}\n        size=\"task\"\n        title={t('hardware.shelly.add')}\n        onClose={closeAddShellyModal}\n      >\n""",
    'modal header action'
)

s = replace_once(
    s,
    """            <div className=\"shelly-network-scan__body\">\n              <div className=\"shelly-network-scan__toolbar\">\n                <span className=\"shelly-network-scan__info\">\n                  <InfoTooltip\n                    label={t('hardware.shelly.infoScanLabel')}\n                    title={t('hardware.shelly.infoScanTitle')}\n                  >\n                    {shellyScanEstimate}\n                    <br />\n                    <br />\n                    {t('hardware.shelly.scannerBehavior')}\n                  </InfoTooltip>\n                </span>\n              </div>\n              <div className=\"shelly-network-scan__range\">\n""",
    """            <div className=\"shelly-network-scan__body\">\n              <div className=\"shelly-network-scan__range\">\n""",
    'remove scan toolbar info row'
)
page.write_text(s)

css = Path('apps/mobile/src/theme/theme.css')
c = css.read_text()
c = replace_once(
    c,
    """.shelly-network-scan__toolbar {\n  align-items: center;\n  display: flex;\n  gap: var(--lcl-spacing-sm);\n  justify-content: flex-end;\n}\n\n""",
    "",
    'remove unused scan toolbar css'
)
css.write_text(c)

test = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
t = test.read_text()
t = replace_once(
    t,
    """    const tooltipButton = within(dialog).getByRole('button', {\n      name: 'Informacja o skanowaniu Shelly'\n    });\n    expect(tooltipButton).toHaveAttribute('aria-expanded', 'false');\n""",
    """    const tooltipButton = within(dialog).getByRole('button', {\n      name: 'Informacja o skanowaniu Shelly'\n    });\n    expect(tooltipButton.closest('.lcl-modal__header-actions')).not.toBeNull();\n    expect(tooltipButton.closest('.shelly-network-scan__body')).toBeNull();\n    expect(tooltipButton).toHaveAttribute('aria-expanded', 'false');\n""",
    'tooltip header placement assertion'
)
test.write_text(t)
