from pathlib import Path

root = Path('.')
modal_path = root / 'apps/mobile/src/screens/InstallationDiagnosticsModal.tsx'
modal_path.write_text(r'''import { DiagnosticRow, Modal } from '@lcl/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from '../app/i18n.js';
import type { ClimateInstalledAutomation } from '../flows/installations/model.js';
import {
  useInstalledAutomationDiagnostics,
  useInstalledAutomationResourceDiagnostics
} from '../flows/installations/useInstalledAutomationRuntime.js';

export const INSTALLATION_DIAGNOSTICS_REFRESH_MS = 3_000;

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.trunc(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return seconds === 0 ? `${totalMinutes} min` : `${totalMinutes} min ${seconds} s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
};

const formatBytes = (value: number | null | undefined, missing: string): string => {
  if (value == null) return missing;
  return value < 1024 ? `${Math.round(value)} B` : `${(value / 1024).toFixed(1)} KiB`;
};

const formatNumber = (
  value: number | null | undefined,
  suffix: string,
  missing: string,
  digits = 1
): string => (value == null ? missing : `${value.toFixed(digits)}${suffix}`);

type InstallationDiagnosticsModalProps = {
  installation: ClimateInstalledAutomation;
  open: boolean;
  onClose(): void;
};

export const InstallationDiagnosticsModal = ({
  installation,
  open,
  onClose
}: InstallationDiagnosticsModalProps) => {
  const { t } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const diagnosticsQuery = useInstalledAutomationDiagnostics(installation, {
    enabled: open,
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });
  const resourcesQuery = useInstalledAutomationResourceDiagnostics(installation, {
    enabled: open,
    refetchInterval: INSTALLATION_DIAGNOSTICS_REFRESH_MS
  });

  useEffect(() => {
    if (!open) return undefined;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const snapshot = diagnosticsQuery.data;
  const diagnostics = snapshot?.diagnostics;
  const script = snapshot?.script;
  const resources = resourcesQuery.data;
  const missing = t('common.missing');

  const snapshotAge =
    diagnosticsQuery.dataUpdatedAt === 0
      ? missing
      : t('hardware.diagnostics.ageAgo', {
          duration: formatDuration(nowMs - diagnosticsQuery.dataUpdatedAt)
        });

  return (
    <Modal
      closeLabel={t('common.close')}
      open={open}
      title={t('common.diagnostics')}
      onClose={onClose}
    >
      {diagnosticsQuery.isPending && (
        <p className="installation-detail-note" role="status">
          {t('common.refreshing')}
        </p>
      )}
      {diagnosticsQuery.isError && (
        <p className="installation-detail-note" role="alert">
          {t('dashboard.readFailed')}
        </p>
      )}
      {snapshot && diagnostics && (
        <div className="installation-diagnostics">
          <section className="installation-diagnostics__section" aria-label={t('hardware.rule.script')}>
            <h3>{t('hardware.rule.script')}</h3>
            <div className="installation-diagnostics__rows">
              <DiagnosticRow
                label={t('hardware.rule.script')}
                value={
                  script?.running === true
                    ? t('hardware.status.running')
                    : script?.running === false
                      ? t('hardware.diagnostics.scriptMissingConfirm')
                      : missing
                }
                tone={script?.running === false ? 'warning' : 'normal'}
              />
              <DiagnosticRow
                label={t('hardware.diagnostics.scriptRpcState')}
                value={
                  resources?.script?.running === true
                    ? 'RUNNING'
                    : resources?.script?.running === false
                      ? 'STOPPED'
                      : missing
                }
              />
              <DiagnosticRow
                label={t('hardware.metrics.configHash')}
                value={script?.configHash ?? missing}
              />
              <DiagnosticRow
                label={t('hardware.diagnostics.scriptCpu')}
                value={formatNumber(resources?.script?.cpuPercent, '%', missing, 1)}
              />
              <DiagnosticRow
                label={t('hardware.diagnostics.scriptMemUsed')}
                value={formatBytes(resources?.script?.memUsedBytes, missing)}
              />
              <DiagnosticRow
                label={t('hardware.diagnostics.scriptMemPeak')}
                value={formatBytes(resources?.script?.memPeakBytes, missing)}
              />
              <DiagnosticRow
                label={t('hardware.diagnostics.scriptMemFree')}
                value={formatBytes(resources?.script?.memFreeBytes, missing)}
              />
              <DiagnosticRow
                label={t('hardware.metrics.snapshotAge')}
                value={snapshotAge}
              />
            </div>
          </section>

          <section className="installation-diagnostics__section" aria-label="Shelly">
            <h3>Shelly</h3>
            <div className="installation-diagnostics__rows">
              <DiagnosticRow
                label={t('hardware.diagnostics.deviceRamFree')}
                value={formatBytes(resources?.system?.ramFreeBytes, missing)}
              />
              <DiagnosticRow
                label={t('hardware.diagnostics.deviceRamTotal')}
                value={formatBytes(resources?.system?.ramSizeBytes, missing)}
              />
              <DiagnosticRow
                label={t('hardware.metrics.clockShelly')}
                value={snapshot.time.localTime ?? missing}
              />
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
};
''')

test_path = root / 'apps/mobile/src/__tests__/automation-detail.test.tsx'
test = test_path.read_text()
test = test.replace(
    "it('opens auto-refreshing scoped technical diagnostics in the shared workspace', async () => {",
    "it('opens compact auto-refreshing technical diagnostics without progressive disclosure', async () => {"
)
test = test.replace(
    "const dialog = await screen.findByRole('dialog', { name: 'Diagnostyka · Salon' });\n    expect(dialog).toHaveClass('lcl-modal--workspace');",
    "const dialog = await screen.findByRole('dialog', { name: 'Diagnostyka' });\n    expect(dialog).toHaveClass('lcl-modal--default');\n    expect(dialog).not.toHaveClass('lcl-modal--workspace');\n    expect(within(dialog).getByRole('heading', { name: 'Skrypt', level: 3 })).toBeVisible();\n    expect(within(dialog).getByRole('heading', { name: 'Shelly', level: 3 })).toBeVisible();\n    expect(within(dialog).queryAllByRole('group')).toHaveLength(0);\n    expect(dialog.querySelectorAll('details')).toHaveLength(0);\n    expect(within(dialog).queryByText('Stan skryptu, hash konfiguracji i zegar Shelly.')).toBeNull();"
)
test = test.replace(
    "expect(screen.queryByRole('dialog', { name: 'Diagnostyka · Salon' })).toBeNull();",
    "expect(screen.queryByRole('dialog', { name: 'Diagnostyka' })).toBeNull();"
)
test_path.write_text(test)

css_path = root / 'apps/mobile/src/theme/theme.css'
css = css_path.read_text()
block = r'''

.installation-diagnostics {
  display: grid;
  gap: var(--lcl-spacing-md);
}

.installation-diagnostics__section {
  display: grid;
  gap: var(--lcl-spacing-xs);
}

.installation-diagnostics__section + .installation-diagnostics__section {
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  padding-top: var(--lcl-spacing-md);
}

.installation-diagnostics__section h3 {
  font-size: var(--lcl-font-size-md);
  line-height: var(--lcl-line-height-compact);
  margin: 0;
}

.installation-diagnostics__rows .lcl-diagnostic-row:last-child {
  border-bottom: 0;
}
'''
if '.installation-diagnostics {' not in css:
    css += block
css_path.write_text(css)
print('Compacted installation diagnostics modal')
