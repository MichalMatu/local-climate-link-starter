from pathlib import Path

path = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
text = path.read_text()
old = '''            <div className="action-row shelly-network-scan__actions">
              <button
                className="secondary-action"
                type="button"
                aria-busy={isShellyScanActive || undefined}
                disabled={isShellyScanActive}
                title={t('hardware.shelly.scanStartTitle')}
                onClick={startShellyScan}
              >
                {isShellyScanActive
                  ? t('hardware.shelly.scanning')
                  : t('hardware.shelly.scanStart')}
              </button>
              {isShellyScanActive && (
                <button
                  className="secondary-action"
                  type="button"
                  title={t('hardware.shelly.scanStopTitle')}
                  onClick={stopShellyScan}
                >
                  {t('hardware.shelly.scanStop')}
                </button>
              )}
            </div>
'''
new = '''            <div className="action-row shelly-network-scan__actions">
              <button
                className="secondary-action"
                type="button"
                title={
                  isShellyScanActive
                    ? t('hardware.shelly.scanStopTitle')
                    : t('hardware.shelly.scanStartTitle')
                }
                onClick={isShellyScanActive ? stopShellyScan : startShellyScan}
              >
                {isShellyScanActive
                  ? t('hardware.shelly.scanStop')
                  : t('hardware.shelly.scanStart')}
              </button>
            </div>
'''
if old not in text:
    raise SystemExit('scan action block anchor missing')
path.write_text(text.replace(old, new, 1))
