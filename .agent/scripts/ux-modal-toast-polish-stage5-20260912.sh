#!/usr/bin/env sh
set -eu

BRANCH=work/ux-polish-20260911
BASE=ded8d77605131b728d66b64a4aee66ce347c1eca

# Start only from the reviewed checkpoint.
git fetch --prune origin "$BRANCH"
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH"
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 <<'PY'
from pathlib import Path
import re

root = Path('.')

# 1) Stable saved-sensor metric geometry and workspace task modals.
p = root / 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
s = p.read_text()
s = s.replace(
    "        open={isAddSensorModalOpen}\n        title={t('hardware.sensor.add')}",
    "        open={isAddSensorModalOpen}\n        size=\"workspace\"\n        title={t('hardware.sensor.add')}",
    1,
)
s = s.replace(
    "        open={isPhoneBleScanModalOpen}\n        title={t('hardware.sensor.phoneBleTitle')}",
    "        open={isPhoneBleScanModalOpen}\n        size=\"workspace\"\n        title={t('hardware.sensor.phoneBleTitle')}",
    1,
)
s = s.replace(
    "                      t('common.missingData')\n                    )}",
    "                      '— °C'\n                    )}",
    1,
)
s = s.replace(
    "                      t('common.missingData')\n                    )}",
    "                      '— %'\n                    )}",
    1,
)
p.write_text(s)

# 2) Shelly add/network scan: one workspace modal, inline scan state/results.
p = root / 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
s = p.read_text()
s = s.replace(
    "import { useCallback, useEffect, useId, useRef, useState } from 'react';",
    "import { useEffect, useId, useRef, useState } from 'react';",
)
s = s.replace("  | { kind: 'scan'; returnToAdd: boolean }\n", "")
s = s.replace("  const isScanModalOpen = dialog.kind === 'scan';\n", "")
s = s.replace(
    "  const returnToAddAfterScan = dialog.kind === 'scan' && dialog.returnToAdd;\n",
    "",
)

s = re.sub(
    r"\n  const dismissShellyScanProgressToast = useCallback\(\(\) => \{.*?\n  \}, \[dismissToastsWhere, t\]\);\n\n  const dismissShellyScanToasts = useCallback\(\(\) => \{.*?\n  \}, \[dismissToastsWhere, t\]\);\n",
    "\n",
    s,
    flags=re.S,
)
# Queue no longer needs predicate dismiss helper after progress toasts are removed.
s = s.replace(
    "  const { dismissToast, dismissToastsWhere, pushToast, toasts } =\n    useToastQueue('shelly-toast');",
    "  const { dismissToast, pushToast, toasts } = useToastQueue('shelly-toast');",
)

# Network-scan error toast stays, but there is no progress toast to dismiss.
s = s.replace("    dismissShellyScanProgressToast();\n", "")
s = s.replace(
    "  }, [dismissShellyScanProgressToast, flow.shellyScanMutation, pushToast, t]);",
    "  }, [flow.shellyScanMutation, pushToast, t]);",
)
# Success only used to dismiss the old progress toast.
s = re.sub(
    r"\n  useEffect\(\(\) => \{\n    if \(!flow\.shellyScanMutation\.isSuccess\) \{\n      return;\n    \}\n    dismissShellyScanProgressToast\(\);\n  \}, \[dismissShellyScanProgressToast, flow\.shellyScanMutation\.isSuccess\]\);\n",
    "\n",
    s,
)

s = s.replace(
    "  const closeAddShellyModal = () => {\n    flow.checkShellyMutation.reset();\n    setDidSubmitShellyAdd(false);\n    setDialog({ kind: 'none' });\n  };",
    "  const closeAddShellyModal = () => {\n    flow.checkShellyMutation.reset();\n    flow.resetShellyScan();\n    setDidSubmitShellyAdd(false);\n    setDidSubmitShellyScan(false);\n    setDialog({ kind: 'none' });\n  };",
)

s = re.sub(
    r"\n  const openScanModalFromAdd = \(\) => \{.*?\n  \};\n\n  const closeScanModal = \(options: \{ returnToAdd\?: boolean \} = \{\}\) => \{.*?\n  \};\n",
    "\n",
    s,
    flags=re.S,
)

s = s.replace(
    "    dismissShellyScanToasts();\n    pushToast('ok', t('hardware.shelly.scanningIpRange'));\n    flow.startShellyScan();",
    "    flow.startShellyScan();",
)
s = s.replace(
    "  const stopShellyScan = () => {\n    if (flow.stopShellyScan()) {\n      dismissShellyScanProgressToast();\n      pushToast('ok', t('hardware.shelly.scanStopped'));\n    }\n  };",
    "  const stopShellyScan = () => {\n    flow.stopShellyScan();\n  };",
)

s = re.sub(
    r"  const addScannedShellyDevice = \(result: ShellySetupScanResult\) => \{.*?\n  \};",
    "  const selectScannedShellyDevice = (result: ShellySetupScanResult) => {\n"
    "    if (!flow.shellyNameInput.trim()) {\n"
    "      flow.setShellyNameInput(result.deviceInfo.model);\n"
    "    }\n"
    "    flow.setShellyUrlInput(result.baseUrl);\n"
    "    flow.resetShellyScan();\n"
    "    setDidSubmitShellyScan(false);\n"
    "  };",
    s,
    flags=re.S,
)

# BLE scanning progress belongs inside the scanner surface, not a start toast.
s = re.sub(
    r"    pushToast\(\n      'ok',\n      t\('hardware\.shelly\.scanningBle'\),\n      t\('hardware\.shelly\.scanningBleSafeOff'\)\n    \);\n",
    "",
    s,
)
s = s.replace(
    "  const restartBleDiscovery = () => {\n    pushToast('ok', t('hardware.shelly.scanningBle'));\n    flow.restartBleDiscovery();\n  };",
    "  const restartBleDiscovery = () => {\n    flow.restartBleDiscovery();\n  };",
)

# Replace the add modal header action with an inline progressive-disclosure scan section.
old_add = '''      <Modal
        busy={flow.checkShellyMutation.isPending}
        closeLabel={t('common.close')}
        open={isAddShellyModalOpen}
        title={t('hardware.shelly.add')}
        headerActions={
          <button
            className="secondary-action modal-header-action--compact"
            type="button"
            disabled={isAnyShellyCheckPending}
            title={t('hardware.shelly.networkScanTitle')}
            onClick={openScanModalFromAdd}
          >
            {t('hardware.shelly.scanNetwork')}
          </button>
        }
        actions={
          <button
            className="primary-action"
            type="button"
            aria-busy={flow.checkShellyMutation.isPending || undefined}
            disabled={isAnyShellyCheckPending}
            title={t('hardware.shelly.addCheckedTitle')}
            onClick={checkShelly}
          >
            {flow.checkShellyMutation.isPending
              ? t('hardware.shelly.checking')
              : t('common.add')}
          </button>
        }
        onClose={closeAddShellyModal}
      >
        <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />
      </Modal>
'''
new_add = '''      <Modal
        busy={flow.checkShellyMutation.isPending}
        closeLabel={t('common.close')}
        open={isAddShellyModalOpen}
        size="workspace"
        title={t('hardware.shelly.add')}
        actions={
          <button
            className="primary-action"
            type="button"
            aria-busy={flow.checkShellyMutation.isPending || undefined}
            disabled={isAnyShellyCheckPending}
            title={t('hardware.shelly.addCheckedTitle')}
            onClick={checkShelly}
          >
            {flow.checkShellyMutation.isPending
              ? t('hardware.shelly.checking')
              : t('common.add')}
          </button>
        }
        onClose={closeAddShellyModal}
      >
        <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />
        <details className="shelly-network-scan">
          <summary>{t('hardware.shelly.scanNetwork')}</summary>
          <div className="shelly-network-scan__body">
            <div className="shelly-network-scan__hint">
              <span>{shellyScanEstimate}</span>
              <InfoTooltip
                label={t('hardware.shelly.infoScanLabel')}
                title={t('hardware.shelly.infoScanTitle')}
              >
                {t('hardware.shelly.apPanelHelp', { url: SHELLY_AP_PANEL_URL })}
                <br />
                {t('hardware.shelly.scannerBehavior')}
              </InfoTooltip>
            </div>
            <div className="field-row">
              <label
                className={showShellyScanRangeError ? 'field field--invalid' : 'field'}
              >
                {t('hardware.shelly.scanRangeStart')}
                <input
                  aria-describedby={showShellyScanRangeError ? scanRangeErrorId : undefined}
                  aria-invalid={showShellyScanRangeError}
                  type="text"
                  inputMode="numeric"
                  placeholder="192.168.0.1"
                  value={flow.shellyScanStartInput}
                  onChange={(event) =>
                    flow.setShellyScanStartInput(event.currentTarget.value)
                  }
                />
              </label>
              <label
                className={showShellyScanRangeError ? 'field field--invalid' : 'field'}
              >
                {t('hardware.shelly.scanRangeEnd')}
                <input
                  aria-describedby={showShellyScanRangeError ? scanRangeErrorId : undefined}
                  aria-invalid={showShellyScanRangeError}
                  type="text"
                  inputMode="numeric"
                  placeholder="192.168.0.99"
                  value={flow.shellyScanEndInput}
                  onChange={(event) => flow.setShellyScanEndInput(event.currentTarget.value)}
                />
                {showShellyScanRangeError && (
                  <span className="field__error" id={scanRangeErrorId}>
                    {shellyScanRangeError}
                  </span>
                )}
              </label>
            </div>
            <div className="action-row shelly-network-scan__actions">
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
            {isShellyScanActive && (
              <div className="scan-loading-state scan-loading-state--compact" role="status">
                <span className="scan-loading-state__spinner" aria-hidden="true" />
                <strong>{t('hardware.shelly.scanningIpRange')}</strong>
                <p>{shellyScanEstimate}</p>
              </div>
            )}
            {shouldShowEmptyScanResult && <p>{t('hardware.shelly.scanResultEmpty')}</p>}
            {scanResults.length > 0 && (
              <div className="saved-list" aria-label={t('hardware.shelly.foundListLabel')}>
                {scanResults.map((result) => (
                  <article key={result.baseUrl} className="saved-list__item">
                    <div className="saved-list__row shelly-scan-result__row">
                      <div className="saved-list__field">
                        <span>{t('common.address')}</span>
                        <strong>{result.baseUrl}</strong>
                      </div>
                      <div className="saved-list__field">
                        <span>{t('common.model')}</span>
                        <strong>
                          {result.deviceInfo.model}, gen {result.deviceInfo.gen}
                        </strong>
                      </div>
                      <button
                        aria-label={t('hardware.shelly.addAria', {
                          address: result.baseUrl
                        })}
                        className="secondary-action shelly-scan-result__add"
                        type="button"
                        onClick={() => selectScannedShellyDevice(result)}
                      >
                        {t('common.select')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </details>
      </Modal>
'''
if old_add not in s:
    raise SystemExit('expected Shelly add modal block not found')
s = s.replace(old_add, new_add, 1)

# Remove the now-redundant standalone network-scan modal.
s, n = re.subn(
    r"\n      <Modal\n        busy=\{isShellyScanActive\}.*?\n      </Modal>\n\n      <Modal\n        closeLabel=\{t\('common\.cancel'\)\}",
    "\n      <Modal\n        closeLabel={t('common.cancel')}",
    s,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f'expected one standalone Shelly scan modal, got {n}')

# Task-like BLE scanner uses the same workspace geometry.
s = s.replace(
    "        open={isBleScanModalOpen}\n        size=\"diagnostic\"\n        title={t('hardware.shelly.scanBleTitle')}",
    "        open={isBleScanModalOpen}\n        size=\"workspace\"\n        title={t('hardware.shelly.scanBleTitle')}",
    1,
)

# Centered scanner progress fills the otherwise blank workspace.
needle = """        {didBleDiscoveryStartFail && (\n          <FeedbackPanel tone=\"warning\" title={t('hardware.shelly.scanBleStartFailed')}>\n            {t('hardware.shelly.scanBleStartFailedDetail')}\n          </FeedbackPanel>\n        )}\n        {bleDiscoveryCandidates.length > 0 && (\n"""
replacement = """        {didBleDiscoveryStartFail && (\n          <FeedbackPanel tone=\"warning\" title={t('hardware.shelly.scanBleStartFailed')}>\n            {t('hardware.shelly.scanBleStartFailedDetail')}\n          </FeedbackPanel>\n        )}\n        {!didBleDiscoveryStartFail &&\n          bleDiscoveryCandidates.length === 0 &&\n          !shouldShowBleRestart && (\n            <div className=\"scan-loading-state\" role=\"status\">\n              <span className=\"scan-loading-state__spinner\" aria-hidden=\"true\" />\n              <strong>{t('hardware.shelly.scanningBle')}</strong>\n              <p>{t('hardware.shelly.scanningBleSafeOff')}</p>\n            </div>\n          )}\n        {bleDiscoveryCandidates.length > 0 && (\n"""
if needle not in s:
    raise SystemExit('expected BLE scanner body marker not found')
s = s.replace(needle, replacement, 1)
p.write_text(s)

# 3) Shared mobile styles: stable placeholder typography + scan/workflow presentation.
p = root / 'apps/mobile/src/theme/theme.css'
s = p.read_text()
s = s.replace(
    ".sensor-data-metric-card--empty .sensor-data-metric-card__value,\n.sensor-data-metric-card__value--empty {\n  color: var(--lcl-color-text-muted);\n  font-size: var(--lcl-font-size-lg);\n  opacity: var(--lcl-opacity-muted);\n}",
    ".sensor-data-metric-card--empty .sensor-data-metric-card__value,\n.sensor-data-metric-card__value--empty {\n  color: var(--lcl-color-text-muted);\n  opacity: var(--lcl-opacity-muted);\n}",
    1,
)
anchor = ".ble-candidate-list {\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n}\n"
styles = """.shelly-network-scan {\n  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  margin-top: var(--lcl-spacing-sm);\n}\n\n.shelly-network-scan > summary {\n  color: var(--lcl-color-text);\n  cursor: pointer;\n  font-weight: var(--lcl-font-weight-bold);\n  list-style-position: inside;\n  min-height: var(--lcl-size-control-min-height);\n  padding: var(--lcl-spacing-md) 0;\n}\n\n.shelly-network-scan__body {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  padding-bottom: var(--lcl-spacing-sm);\n}\n\n.shelly-network-scan__hint {\n  align-items: center;\n  color: var(--lcl-color-text-muted);\n  display: flex;\n  font-size: var(--lcl-font-size-sm);\n  gap: var(--lcl-spacing-sm);\n  justify-content: space-between;\n}\n\n.shelly-network-scan__actions {\n  gap: var(--lcl-spacing-sm);\n}\n\n.scan-loading-state {\n  align-content: center;\n  align-items: center;\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  justify-items: center;\n  min-height: min(42dvh, 18rem);\n  padding: var(--lcl-spacing-xl) var(--lcl-spacing-md);\n  text-align: center;\n}\n\n.scan-loading-state--compact {\n  min-height: 9rem;\n  padding-block: var(--lcl-spacing-lg);\n}\n\n.scan-loading-state strong {\n  color: var(--lcl-color-text);\n  font-size: var(--lcl-font-size-lg);\n}\n\n.scan-loading-state p {\n  max-width: var(--lcl-size-prose-max-width);\n}\n\n.scan-loading-state__spinner {\n  animation: lcl-scan-spin 0.85s linear infinite;\n  border: var(--lcl-border-width-md) solid var(--lcl-color-border);\n  border-radius: 50%;\n  border-top-color: var(--lcl-color-accent);\n  height: calc(var(--lcl-size-control-icon-size) + var(--lcl-spacing-md));\n  width: calc(var(--lcl-size-control-icon-size) + var(--lcl-spacing-md));\n}\n\n@keyframes lcl-scan-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .scan-loading-state__spinner {\n    animation: none;\n  }\n}\n\n"""
if anchor not in s:
    raise SystemExit('theme anchor not found')
s = s.replace(anchor, styles + anchor, 1)
p.write_text(s)

# 4) Toasts sit consistently just above bottom navigation instead of floating high.
p = root / 'apps/mobile/src/components/AppBottomNavigation.css'
s = p.read_text()
s = s.replace(
    "  --app-bottom-nav-height: calc(\n    var(--lcl-size-control-min-height) + var(--lcl-spacing-lg)\n  );",
    "  --app-bottom-nav-height: calc(\n    var(--lcl-size-control-min-height) + var(--lcl-spacing-lg)\n  );\n  --app-toast-bottom-gap: var(--lcl-spacing-xs);",
    1,
)
s = s.replace(
    "    var(--app-bottom-nav-height) + var(--lcl-spacing-lg) + env(safe-area-inset-bottom)",
    "    var(--app-bottom-nav-height) + var(--app-toast-bottom-gap) +\n      env(safe-area-inset-bottom)",
    1,
)
p.write_text(s)

# 5) One shared localized verb for selecting a discovered device.
translations = {
    'pl.ts': 'Wybierz',
    'en.ts': 'Select',
    'de.ts': 'Auswählen',
    'es.ts': 'Seleccionar',
    'fr.ts': 'Sélectionner',
    'it.ts': 'Seleziona',
    'ptBr.ts': 'Selecionar',
}
for filename, value in translations.items():
    p = root / 'apps/mobile/src/app/locales' / filename
    s = p.read_text()
    marker = "    send: "
    idx = s.find(marker)
    if idx < 0:
        raise SystemExit(f'common.send marker missing in {filename}')
    line_start = idx
    s = s[:line_start] + f"    select: '{value}',\n" + s[line_start:]
    p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/components/AppBottomNavigation.css \
  apps/mobile/src/app/locales/pl.ts \
  apps/mobile/src/app/locales/en.ts \
  apps/mobile/src/app/locales/de.ts \
  apps/mobile/src/app/locales/es.ts \
  apps/mobile/src/app/locales/fr.ts \
  apps/mobile/src/app/locales/it.ts \
  apps/mobile/src/app/locales/ptBr.ts

pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- --run
pnpm --filter @lcl/mobile build

# Full repository check before checkpointing the stage.
pnpm check

git diff --check
git status --short

git add \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/components/AppBottomNavigation.css \
  apps/mobile/src/app/locales/pl.ts \
  apps/mobile/src/app/locales/en.ts \
  apps/mobile/src/app/locales/de.ts \
  apps/mobile/src/app/locales/es.ts \
  apps/mobile/src/app/locales/fr.ts \
  apps/mobile/src/app/locales/it.ts \
  apps/mobile/src/app/locales/ptBr.ts

git commit -m "Polish modal scan and toast flows"
git push origin "$BRANCH"

echo UX_STAGE5_SHA=$(git rev-parse HEAD)
