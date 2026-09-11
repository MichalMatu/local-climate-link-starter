#!/usr/bin/env sh
set -eu

BASE=974a25872f05758a54437f37c931f6769793b4ea
BRANCH=work/ux-polish-20260911

git fetch --prune origin "$BRANCH" >/dev/null
test "$(git rev-parse origin/$BRANCH)" = "$BASE"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null
test "$(git rev-parse HEAD)" = "$BASE"
test -z "$(git status --porcelain)"

python3 - <<'PY'
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)

p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx')
s = p.read_text()

old = """  const relayToggleLabel = controlStatus?.relayOn ? 'OFF' : 'ON';
  const relayToggleTitle =
    controlStatus === null
      ? t('hardware.shelly.relayUnknownTitle')
      : controlStatus.relayOn
        ? t('hardware.shelly.relayOnTitle')
        : t('hardware.shelly.relayOffTitle');
  const relayToggleClass =
    controlStatus === null
      ? 'secondary-action relay-toggle relay-toggle--unknown'
      : controlStatus.relayOn
        ? 'secondary-action relay-toggle relay-toggle--on'
        : 'secondary-action relay-toggle relay-toggle--off';
  const automationMode = controlStatus?.automationMode ?? null;
  const automationToggleLabel = automationMode === 'auto' ? 'MANUAL' : 'AUTO';
  const automationToggleTitle =
    automationMode === 'auto'
      ? t('hardware.shelly.automationAutoTitle')
      : automationMode === 'manual'
        ? t('hardware.shelly.automationManualTitle')
        : automationMode === 'missing'
          ? t('hardware.shelly.automationMissingTitle')
          : t('hardware.shelly.automationUnknownTitle');
  const automationToggleClass =
    automationMode === 'auto'
      ? 'secondary-action automation-toggle automation-toggle--auto'
      : automationMode === 'manual'
        ? 'secondary-action automation-toggle automation-toggle--manual'
        : automationMode === 'missing'
          ? 'secondary-action automation-toggle automation-toggle--missing'
          : 'secondary-action automation-toggle automation-toggle--unknown';"""
new = """  const automationMode = controlStatus?.automationMode ?? null;
  const manualControl = automationMode === 'manual';"""
s = replace_once(s, old, new, 'control state derivation')

old = """        <div className=\"shelly-card-actions\">
          <button
            className=\"icon-action\"
            type=\"button\"
            aria-label={t('hardware.shelly.settings')}
            title={t('hardware.shelly.settings')}
            onClick={() => onInfoOpen(device)}
          >
            <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />
          </button>
          <button
            className=\"icon-action\"
            type=\"button\"
            disabled={isControlBusy}
            aria-label={t('hardware.shelly.scanBleViaShellyTitle')}
            title={t('hardware.shelly.scanBleViaShellyTitle')}
            onClick={() => onBleScan(device)}
          >
            <IconBluetooth className=\"icon-action__svg\" aria-hidden=\"true\" />
          </button>
          <button
            className=\"icon-action icon-action--danger\"
            type=\"button\"
            aria-label={t('hardware.shelly.deleteTitle')}
            title={t('hardware.shelly.deleteTitle')}
            onClick={() => onRemove(device)}
          >
            <IconTrash className=\"icon-action__svg\" aria-hidden=\"true\" />
          </button>
        </div>"""
new = """        <div className=\"shelly-card-actions\">
          <button
            className=\"icon-action icon-action--danger\"
            type=\"button\"
            aria-label={t('hardware.shelly.deleteTitle')}
            title={t('hardware.shelly.deleteTitle')}
            onClick={() => onRemove(device)}
          >
            <IconTrash className=\"icon-action__svg\" aria-hidden=\"true\" />
          </button>
        </div>"""
s = replace_once(s, old, new, 'header actions')

old = """      <div className=\"shelly-state-strip\">
        <span>
          {t('hardware.metrics.relay')}{' '}
          <strong>
            {controlStatus ? (controlStatus.relayOn ? 'ON' : 'OFF') : t('common.missing')}
          </strong>
        </span>
        <span>
          {t('hardware.metrics.mode')}{' '}
          <strong>{formatAutomationMode(automationMode ?? undefined, t)}</strong>
        </span>
      </div>

"""
s = replace_once(s, old, '', 'redundant state strip')

old = """      <div
        className=\"control-action-row shelly-control-toolbar\"
        aria-label={t('hardware.shelly.controlLabel', { name: device.name })}
      >
        <button
          className={automationToggleClass}
          type=\"button\"
          disabled={isControlBusy}
          title={automationToggleTitle}
          onClick={() =>
            automationMode === 'auto'
              ? onAutomationManual(device)
              : onAutomationAuto(device)
          }
        >
          {automationToggleLabel}
        </button>
        <button
          className={relayToggleClass}
          type=\"button\"
          disabled={isControlBusy}
          title={relayToggleTitle}
          onClick={() =>
            controlStatus?.relayOn ? onRelayOff(device) : onRelayOn(device)
          }
        >
          {relayToggleLabel}
        </button>
      </div>"""
new = """      <button
        className=\"shelly-ble-action\"
        type=\"button\"
        disabled={isControlBusy}
        title={t('hardware.shelly.scanBleViaShellyTitle')}
        onClick={() => onBleScan(device)}
      >
        <IconBluetooth className=\"icon-action__svg\" aria-hidden=\"true\" />
        <span>{t('hardware.shelly.scanBleViaShellyTitle')}</span>
      </button>

      <div
        className=\"shelly-runtime-controls\"
        aria-label={t('hardware.shelly.controlLabel', { name: device.name })}
      >
        <div className=\"shelly-mode-row\">
          <div
            className=\"automation-control-group shelly-mode-control\"
            role=\"group\"
            aria-label={t('hardware.metrics.mode')}
          >
            <button
              className=\"automation-control-button\"
              type=\"button\"
              aria-pressed={automationMode === 'auto'}
              disabled={isControlBusy}
              onClick={() => {
                if (automationMode !== 'auto') onAutomationAuto(device);
              }}
            >
              AUTO
            </button>
            <button
              className=\"automation-control-button\"
              type=\"button\"
              aria-pressed={manualControl}
              disabled={isControlBusy}
              onClick={() => {
                if (!manualControl) onAutomationManual(device);
              }}
            >
              MANUAL
            </button>
          </div>
          <button
            className=\"icon-action\"
            type=\"button\"
            aria-label={t('hardware.shelly.settings')}
            title={t('hardware.shelly.settings')}
            onClick={() => onInfoOpen(device)}
          >
            <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />
          </button>
        </div>

        <div
          className=\"automation-relay-actions shelly-relay-actions\"
          role=\"group\"
          aria-label={t('hardware.metrics.relay')}
        >
          <button
            className=\"automation-relay-button\"
            type=\"button\"
            aria-pressed={controlStatus?.relayOn === true}
            disabled={isControlBusy || !manualControl}
            onClick={() => {
              if (controlStatus?.relayOn !== true) onRelayOn(device);
            }}
          >
            ON
          </button>
          <button
            className=\"automation-relay-button\"
            type=\"button\"
            aria-pressed={controlStatus?.relayOn === false}
            disabled={isControlBusy || !manualControl}
            onClick={() => {
              if (controlStatus?.relayOn === true) onRelayOff(device);
            }}
          >
            OFF
          </button>
        </div>
      </div>"""
s = replace_once(s, old, new, 'runtime controls')
p.write_text(s)

# Put the technical mode/state into the single info modal.
p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
s = replace_once(
    s,
    """  formatClockUptime,
  formatComponentState,""",
    """  formatClockUptime,
  formatComponentState,
  formatAutomationMode,""",
    'presentation import'
)
old = """              <DiagnosticRow
                label={t('common.firmware')}
                value={infoStatus?.firmwareId ?? t('common.missingData')}
              />
              <DiagnosticRow
                label={t('hardware.metrics.wifiRssi')}"""
new = """              <DiagnosticRow
                label={t('common.firmware')}
                value={infoStatus?.firmwareId ?? t('common.missingData')}
              />
              <DiagnosticRow
                label={t('hardware.metrics.relay')}
                value={
                  infoStatus
                    ? infoStatus.relayOn
                      ? 'ON'
                      : 'OFF'
                    : t('common.missingData')
                }
              />
              <DiagnosticRow
                label={t('hardware.metrics.mode')}
                value={formatAutomationMode(infoStatus?.automationMode, t)}
              />
              <DiagnosticRow
                label={t('hardware.metrics.wifiRssi')}"""
s = replace_once(s, old, new, 'info modal state rows')
p.write_text(s)

# Style Shelly controls like the compact dashboard controls, without nested/double frames.
p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
old = """.shelly-control-toolbar {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  margin-left: 0;
  width: 100%;
}

.shelly-control-toolbar .secondary-action {
  min-width: 0;
  width: 100%;
}

"""
if old in s:
    s = s.replace(old, '', 1)

s += """

/* Shelly runtime controls aligned with the dashboard controls. */
.shelly-ble-action {
  align-items: center;
  align-self: start;
  background: transparent;
  border: 0;
  color: var(--lcl-color-accent);
  cursor: pointer;
  display: inline-flex;
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-bold);
  gap: var(--lcl-spacing-xs);
  justify-content: flex-start;
  min-height: var(--lcl-size-compact-control-min-height);
  padding: 0;
  text-align: left;
  width: fit-content;
}

.shelly-ble-action:disabled {
  cursor: not-allowed;
  opacity: var(--lcl-opacity-disabled);
}

.shelly-runtime-controls {
  display: grid;
  gap: var(--lcl-spacing-sm);
  width: 100%;
}

.shelly-mode-row {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
}

.shelly-saved-card .shelly-mode-control {
  background: var(--lcl-color-surface-muted);
  border: 0;
  border-radius: var(--lcl-radius-round);
  display: flex;
  flex: 0 1 var(--lcl-size-action-min-width);
  max-width: var(--lcl-size-action-min-width);
  overflow: hidden;
  width: 100%;
}

.shelly-saved-card .shelly-mode-control > * {
  flex: 1 1 0;
}

.shelly-saved-card .shelly-mode-control .automation-control-button {
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-round);
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-xs);
  min-height: var(--lcl-size-compact-control-min-height);
  padding: 0 var(--lcl-spacing-xs);
}

.shelly-saved-card
  .shelly-mode-control
  .automation-control-button[aria-pressed='true'] {
  background: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}

.shelly-relay-actions {
  display: flex;
  gap: var(--lcl-spacing-sm);
  width: 100%;
}

.shelly-relay-actions > * {
  flex: 1 1 0;
}

.shelly-saved-card .shelly-relay-actions .automation-relay-button {
  min-height: var(--lcl-size-compact-control-min-height);
}
"""
p.write_text(s)

# Update focused UI expectations to the new segmented controls and info placement.
p = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
s = p.read_text()
s = replace_once(
    s,
    """    expect(within(savedPlugList).getByText('Przekaźnik')).toBeInTheDocument();
    expect(within(savedPlugList).getByText('Tryb')).toBeInTheDocument();""",
    """    expect(within(savedPlugList).queryByText('Przekaźnik')).not.toBeInTheDocument();
    expect(within(savedPlugList).queryByText('Tryb')).not.toBeInTheDocument();""",
    'state labels hidden from card'
)
s = replace_once(
    s,
    """    expect(
      within(infoDialog).getByText('20260311-095902/1.7.5-g9979d16')
    ).toBeInTheDocument();
    fireEvent.click(within(infoDialog).getByRole('button', { name: 'Zamknij' }));

    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const relayButton = within(actionRow).getByRole('button', { name: 'ON' });
    expect(relayButton).toHaveClass('relay-toggle--off');
    expect(relayButton).toHaveAttribute(
      'title',
      'Przekaźnik jest OFF. Kliknij ON, żeby włączyć.'
    );
    expect(
      within(actionRow)
        .getAllByRole('button')
        .map((button) => button.textContent)
        .filter(Boolean)
    ).toEqual(['MANUAL', 'ON']);
    expect(
      within(actionRow).queryByRole('button', { name: 'Odśwież' })
    ).not.toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: 'MANUAL' })).toHaveClass(
      'automation-toggle--auto'
    );

    fireEvent.click(relayButton);""",
    """    expect(
      within(infoDialog).getByText('20260311-095902/1.7.5-g9979d16')
    ).toBeInTheDocument();
    expect(within(infoDialog).getByText('Przekaźnik')).toBeInTheDocument();
    expect(within(infoDialog).getByText('Tryb')).toBeInTheDocument();
    fireEvent.click(within(infoDialog).getByRole('button', { name: 'Zamknij' }));

    const actionRow = within(savedPlugList).getByLabelText(/^Sterowanie /);
    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    const manualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });
    expect(autoButton).toHaveAttribute('aria-pressed', 'true');
    expect(manualButton).toHaveAttribute('aria-pressed', 'false');

    const relayButton = within(actionRow).getByRole('button', { name: 'ON' });
    expect(relayButton).toBeDisabled();
    fireEvent.click(manualButton);
    await screen.findByText('Tryb MANUAL. Przekaźnik OFF.');
    expect(relayButton).not.toBeDisabled();

    fireEvent.click(relayButton);""",
    'segmented control assertions'
)
s = replace_once(
    s,
    """    const offButton = within(actionRow).getByRole('button', { name: 'OFF' });
    expect(offButton).toHaveClass('relay-toggle--on');
    expect(offButton).toHaveAttribute(
      'title',
      'Przekaźnik jest ON. Kliknij OFF, żeby wyłączyć.'
    );

    fireEvent.click(offButton);""",
    """    const offButton = within(actionRow).getByRole('button', { name: 'OFF' });
    expect(offButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(offButton);""",
    'relay off assertions'
)
s = replace_once(
    s,
    """    expect(within(actionRow).getByRole('button', { name: 'ON' })).toHaveClass(
      'relay-toggle--off'
    );""",
    """    expect(within(actionRow).getByRole('button', { name: 'OFF' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );""",
    'relay final state assertion'
)
s = replace_once(
    s,
    """    const manualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });
    expect(manualButton).toHaveClass('automation-toggle--auto');

    fireEvent.click(manualButton);""",
    """    const manualButton = within(actionRow).getByRole('button', { name: 'MANUAL' });
    expect(manualButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(manualButton);""",
    'mode initial assertion'
)
s = replace_once(
    s,
    """    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    expect(autoButton).toHaveClass('automation-toggle--manual');

    fireEvent.click(autoButton);""",
    """    expect(manualButton).toHaveAttribute('aria-pressed', 'true');
    const autoButton = within(actionRow).getByRole('button', { name: 'AUTO' });
    expect(autoButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(autoButton);""",
    'mode manual assertion'
)
s = replace_once(
    s,
    """    expect(within(actionRow).getByRole('button', { name: 'ON' })).toHaveClass(
      'relay-toggle--unknown'
    );
    expect(
      within(actionRow)
        .getAllByRole('button')
        .map((button) => button.textContent)
        .filter(Boolean)
    ).toEqual(['AUTO', 'ON']);
    expect(within(actionRow).getByRole('button', { name: 'AUTO' })).toHaveClass(
      'automation-toggle--unknown'
    );""",
    """    expect(within(actionRow).getByRole('button', { name: 'AUTO' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(within(actionRow).getByRole('button', { name: 'MANUAL' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(within(actionRow).getByRole('button', { name: 'ON' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(within(actionRow).getByRole('button', { name: 'OFF' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );""",
    'unknown segmented controls'
)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm exec eslint \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile test -- hardware-setup.test.tsx
pnpm --filter @lcl/mobile build
git diff --check

git add \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx \
  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx \
  apps/mobile/src/theme/theme.css \
  apps/mobile/src/__tests__/hardware-setup.test.tsx
git diff --cached --check
git commit -m "Align Shelly runtime controls with dashboard"
git push --force-with-lease origin "$BRANCH"

echo SHELLY_STAGE4_SHA=$(git rev-parse HEAD)
