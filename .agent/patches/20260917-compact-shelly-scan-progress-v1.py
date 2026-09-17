from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

page = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
old_loader = """            {isShellyScanActive && (\n              <div className=\"scan-loading-state scan-loading-state--compact\">\n                <span className=\"scan-loading-state__spinner\" aria-hidden=\"true\" />\n                <strong>{t('hardware.shelly.scanningIpRange')}</strong>\n              </div>\n            )}\n            {shouldShowEmptyScanResult && <p>{t('hardware.shelly.scanResultEmpty')}</p>}\n            {scanResults.length > 0 && (\n"""
new_loader = """            {shouldShowEmptyScanResult && <p>{t('hardware.shelly.scanResultEmpty')}</p>}\n            {scanResults.length > 0 && (\n"""
replace(page, old_loader, new_loader)
anchor = """            {scanResults.length > 0 && (\n              <div\n                className=\"saved-list\"\n                aria-label={t('hardware.shelly.foundListLabel')}\n              >\n                {scanResults.map((result) => (\n                  <article key={result.baseUrl} className=\"saved-list__item\">\n                    <div className=\"saved-list__row shelly-scan-result__row\">\n                      <div className=\"saved-list__field\">\n                        <span>{t('common.address')}</span>\n                        <strong>{result.baseUrl}</strong>\n                      </div>\n                      <div className=\"saved-list__field\">\n                        <span>{t('common.model')}</span>\n                        <strong>\n                          {result.deviceInfo.model}, gen {result.deviceInfo.gen}\n                        </strong>\n                      </div>\n                      <button\n                        aria-label={\n                          isSavedShellyScanResult(result)\n                            ? `${t('hardware.shelly.alreadyAdded')}: ${result.baseUrl}`\n                            : `${t('common.select')}: ${result.baseUrl}`\n                        }\n                        className=\"secondary-action shelly-scan-result__add\"\n                        type=\"button\"\n                        disabled={isSavedShellyScanResult(result)}\n                        onClick={() => selectScannedShellyDevice(result)}\n                      >\n                        {isSavedShellyScanResult(result)\n                          ? t('hardware.shelly.alreadyAdded')\n                          : t('common.select')}\n                      </button>\n                    </div>\n                  </article>\n                ))}\n              </div>\n            )}\n"""
replacement = anchor + """            {isShellyScanActive && (\n              <div className=\"shelly-network-scan__progress\" role=\"status\">\n                <span className=\"scan-loading-state__spinner\" aria-hidden=\"true\" />\n                <span>{t('hardware.shelly.scanningIpRange')}</span>\n              </div>\n            )}\n"""
replace(page, anchor, replacement)

css = 'apps/mobile/src/theme/theme.css'
anchor_css = """.shelly-scan-result__add {\n  align-self: end;\n  min-width: var(--lcl-size-action-min-width);\n}\n"""
new_css = anchor_css + """\n.shelly-network-scan__progress {\n  align-items: center;\n  color: var(--lcl-color-text-muted);\n  display: flex;\n  font-size: var(--lcl-font-size-sm);\n  font-weight: var(--lcl-font-weight-semibold);\n  gap: var(--lcl-spacing-sm);\n  justify-content: center;\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding-block: var(--lcl-spacing-sm);\n}\n\n.shelly-network-scan__progress .scan-loading-state__spinner {\n  height: 1.5rem;\n  width: 1.5rem;\n}\n"""
replace(css, anchor_css, new_css)
