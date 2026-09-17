from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    p.write_text(text.replace(old, new, 1))

page = "apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx"
replace_once(
    page,
    '''            <div className="shelly-network-scan__toolbar">
              <div
                className="shelly-network-scan__presets"
                role="group"
                aria-label={t('hardware.shelly.networkScanTitle')}
              >
                <button
                  className="shelly-network-scan__preset"
                  type="button"
                  disabled={isShellyScanActive}
                  onClick={() =>
                    applyShellyScanPreset(SHELLY_AP_SCAN_ADDRESS, SHELLY_AP_SCAN_ADDRESS)
                  }
                >
                  AP mode
                </button>
                <span
                  className="shelly-network-scan__preset-separator"
                  aria-hidden="true"
                >
                  ·
                </span>
                <button
                  className="shelly-network-scan__preset"
                  type="button"
                  disabled={isShellyScanActive}
                  onClick={() =>
                    applyShellyScanPreset(SHELLY_STA_SCAN_START, SHELLY_STA_SCAN_END)
                  }
                >
                  STA mode
                </button>
              </div>
              <span className="shelly-network-scan__info">
''',
    '''            <div className="shelly-network-scan__toolbar">
              <span className="shelly-network-scan__info">
''',
)

replace_once(
    page,
    '''            </div>
            <div className="action-row shelly-network-scan__actions">
''',
    '''            </div>
            <div
              className="shelly-network-scan__presets"
              role="group"
              aria-label={t('hardware.shelly.networkScanTitle')}
            >
              <button
                className="shelly-network-scan__preset"
                type="button"
                disabled={isShellyScanActive}
                onClick={() =>
                  applyShellyScanPreset(SHELLY_STA_SCAN_START, SHELLY_STA_SCAN_END)
                }
              >
                STA
              </button>
              <span
                className="shelly-network-scan__preset-separator"
                aria-hidden="true"
              >
                ·
              </span>
              <button
                className="shelly-network-scan__preset"
                type="button"
                disabled={isShellyScanActive}
                onClick={() =>
                  applyShellyScanPreset(SHELLY_AP_SCAN_ADDRESS, SHELLY_AP_SCAN_ADDRESS)
                }
              >
                AP
              </button>
            </div>
            <div className="action-row shelly-network-scan__actions">
''',
)

css = "apps/mobile/src/theme/theme.css"
replace_once(
    css,
    '''.shelly-network-scan__toolbar {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
}
''',
    '''.shelly-network-scan__toolbar {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: flex-end;
}
''',
)
replace_once(
    css,
    '''.shelly-network-scan__presets {
  align-items: center;
  display: inline-flex;
  gap: var(--lcl-spacing-sm);
  min-width: 0;
}
''',
    '''.shelly-network-scan__presets {
  align-items: center;
  display: inline-flex;
  gap: var(--lcl-spacing-sm);
  justify-self: center;
  min-width: 0;
}
''',
)

test = "apps/mobile/src/__tests__/hardware-setup.test.tsx"
replace_once(
    test,
    "within(dialog).getByRole('button', { name: 'AP mode' })",
    "within(dialog).getByRole('button', { name: 'AP' })",
)
replace_once(
    test,
    "within(dialog).getByRole('button', { name: 'STA mode' })",
    "within(dialog).getByRole('button', { name: 'STA' })",
)
