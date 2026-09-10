from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:80]!r}")
    path.write_text(text.replace(old, new, 1))

runtime = Path('apps/mobile/src/flows/installations/runtimeControl.ts')
text = runtime.read_text()
marker = "export const readInstalledAutomationControlStatus = (\n  installation: ClimateInstalledAutomation\n): Promise<ShellyControlStatus> => readShellyControlStatus(installation.shelly.baseUrl);\n\n"
insert = marker + "const requireMatchedInstalledAutomation = async (\n  installation: ClimateInstalledAutomation\n): Promise<ShellyControlStatus> => {\n  const status = await readInstalledAutomationControlStatus(installation);\n  if (installedAutomationScriptMatch(installation, status) !== 'matched') {\n    throw new Error('Stored automation script does not match Shelly.');\n  }\n  return status;\n};\n\n"
if marker not in text:
    raise SystemExit('runtime control marker missing')
text = text.replace(marker, insert, 1)
text = text.replace(
    "  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));\n  const relayId = installation.config.output.relayId;\n\n  // Never stop the controller",
    "  const relayId = installation.config.output.relayId;\n  await requireMatchedInstalledAutomation(installation);\n  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));\n\n  // Never stop the controller",
    1,
)
old_resume = """export const resumeInstalledAutomation = async (\n  installation: ClimateInstalledAutomation\n): Promise<ShellyControlStatus> => {\n  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));\n  unwrapShellyResult(\n    await client.setRelayOff({ relayId: installation.config.output.relayId })\n  );\n  unwrapShellyResult(await client.startScript(installation.script.id));\n\n  const controlStatus = await readShellyControlStatus(installation.shelly.baseUrl);\n  if (\n    installedAutomationScriptMatch(installation, controlStatus) !== 'matched' ||\n    controlStatus.automationMode !== 'auto'\n  ) {\n    throw new Error('Shelly did not confirm a running automation.');\n  }\n  return controlStatus;\n};\n\n"""
new_resume = """export const resumeInstalledAutomation = async (\n  installation: ClimateInstalledAutomation\n): Promise<ShellyControlStatus> => {\n  const initialStatus = await requireMatchedInstalledAutomation(installation);\n  if (initialStatus.automationMode !== 'manual') {\n    throw new Error('Automation must be paused before it can be resumed.');\n  }\n\n  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));\n  unwrapShellyResult(\n    await client.setRelayOff({ relayId: installation.config.output.relayId })\n  );\n  unwrapShellyResult(await client.startScript(installation.script.id));\n\n  const controlStatus = await requireMatchedInstalledAutomation(installation);\n  if (controlStatus.automationMode !== 'auto') {\n    throw new Error('Shelly did not confirm a running automation.');\n  }\n  return controlStatus;\n};\n\nexport const setInstalledAutomationRelayState = async (\n  installation: ClimateInstalledAutomation,\n  on: boolean\n): Promise<ShellyControlStatus> => {\n  const initialStatus = await requireMatchedInstalledAutomation(installation);\n  if (initialStatus.automationMode !== 'manual') {\n    throw new Error('Manual relay control requires a paused automation.');\n  }\n\n  const relayId = installation.config.output.relayId;\n  const client = new RpcShellyClient(createShellyTransport(installation.shelly.baseUrl));\n  unwrapShellyResult(\n    on ? await client.setRelayOn({ relayId }) : await client.setRelayOff({ relayId })\n  );\n\n  const verified = await requireMatchedInstalledAutomation(installation);\n  if (verified.automationMode !== 'manual' || verified.relayOn !== on) {\n    throw new Error(`Shelly did not confirm relay ${on ? 'ON' : 'OFF'} in manual mode.`);\n  }\n  return verified;\n};\n\n"""
if old_resume not in text:
    raise SystemExit('resume marker missing')
text = text.replace(old_resume, new_resume, 1)
runtime.write_text(text)

hooks = Path('apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts')
hooks.write_text("""import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';\nimport type { ClimateInstalledAutomation } from './model.js';\nimport { fetchInstalledAutomationDiagnostics } from './runtimeDiagnostics.js';\nimport {\n  pauseInstalledAutomation,\n  readInstalledAutomationControlStatus,\n  resumeInstalledAutomation,\n  setInstalledAutomationRelayState\n} from './runtimeControl.js';\n\nconst installationQueryIdentity = (installation: ClimateInstalledAutomation) =>\n  [\n    installation.id,\n    installation.shelly.baseUrl,\n    installation.script.id,\n    installation.script.hash,\n    installation.updatedAtMs\n  ] as const;\n\nexport const installedAutomationDiagnosticsQueryKey = (\n  installation: ClimateInstalledAutomation\n) =>\n  [\n    'installed-automation-diagnostics',\n    ...installationQueryIdentity(installation)\n  ] as const;\n\nexport const installedAutomationControlQueryKey = (\n  installation: ClimateInstalledAutomation\n) =>\n  ['installed-automation-control', ...installationQueryIdentity(installation)] as const;\n\nexport const useInstalledAutomationDiagnostics = (\n  installation: ClimateInstalledAutomation,\n  options: { enabled?: boolean } = {}\n) =>\n  useQuery({\n    queryKey: installedAutomationDiagnosticsQueryKey(installation),\n    queryFn: () => fetchInstalledAutomationDiagnostics(installation),\n    enabled: options.enabled ?? true,\n    retry: false,\n    refetchInterval: 30_000,\n    refetchOnWindowFocus: false\n  });\n\nexport const useInstalledAutomationControl = (\n  installation: ClimateInstalledAutomation,\n  options: { enabled?: boolean } = {}\n) =>\n  useQuery({\n    queryKey: installedAutomationControlQueryKey(installation),\n    queryFn: () => readInstalledAutomationControlStatus(installation),\n    enabled: options.enabled ?? true,\n    retry: false,\n    refetchInterval: 30_000,\n    refetchOnWindowFocus: false\n  });\n\nexport type InstalledAutomationControlAction = 'auto' | 'manual' | 'on' | 'off';\n\nexport const useInstalledAutomationActions = (installation: ClimateInstalledAutomation) => {\n  const queryClient = useQueryClient();\n\n  return useMutation({\n    mutationFn: (action: InstalledAutomationControlAction) => {\n      switch (action) {\n        case 'auto':\n          return resumeInstalledAutomation(installation);\n        case 'manual':\n          return pauseInstalledAutomation(installation);\n        case 'on':\n          return setInstalledAutomationRelayState(installation, true);\n        case 'off':\n          return setInstalledAutomationRelayState(installation, false);\n      }\n    },\n    onSuccess: (status) => {\n      queryClient.setQueryData(installedAutomationControlQueryKey(installation), status);\n      void queryClient.invalidateQueries({\n        queryKey: installedAutomationDiagnosticsQueryKey(installation)\n      });\n    }\n  });\n};\n""")

dashboard = Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
text = dashboard.read_text()
text = text.replace(
    "  useInstalledAutomationControl,\n  useInstalledAutomationDiagnostics\n",
    "  useInstalledAutomationActions,\n  useInstalledAutomationControl,\n  useInstalledAutomationDiagnostics\n",
    1,
)
start = text.index('const ClimateAutomationCard = (')
end = text.index('\nconst AutomationCard =', start)
new_card = r'''const ClimateAutomationCard = ({
  installation,
  onOpen
}: {
  installation: ClimateInstalledAutomation;
  onOpen(installationId: string): void;
}) => {
  const { t } = useTranslation();
  const query = useInstalledAutomationDiagnostics(installation);
  const control = useInstalledAutomationControl(installation);
  const action = useInstalledAutomationActions(installation);

  const snapshot = query.data;
  const health = snapshot ? installedAutomationHealth(snapshot) : null;
  const controlStatus = control.data;
  const controlMatch = controlStatus
    ? installedAutomationScriptMatch(installation, controlStatus)
    : null;
  const controlsVerified = controlMatch === 'matched';
  const manualControl = controlsVerified && controlStatus?.automationMode === 'manual';
  const relayState =
    controlStatus?.relayOn ?? snapshot?.plug?.relayState ?? snapshot?.diagnostics.relayState;

  const refresh = () => {
    void Promise.all([query.refetch(), control.refetch()]);
  };

  return (
    <article className="automation-card">
      <header className="automation-card__header">
        <div className="automation-card__identity">
          <div className="automation-status-row">
            {controlsVerified && controlStatus?.automationMode === 'manual' ? (
              <span className="automation-health automation-health--paused">
                {t('dashboard.health.paused')}
              </span>
            ) : controlMatch !== null && controlMatch !== 'matched' ? (
              <span className="automation-health automation-health--attention">
                {t('dashboard.health.attention')}
              </span>
            ) : query.isError ? (
              control.isPending ? (
                <span className="automation-health automation-health--unknown">
                  {t('dashboard.health.loading')}
                </span>
              ) : control.isError ? (
                <span className="automation-health automation-health--offline">
                  {t('dashboard.health.offline')}
                </span>
              ) : (
                <span className="automation-health automation-health--attention">
                  {t('dashboard.health.attention')}
                </span>
              )
            ) : query.isPending ? (
              <span className="automation-health automation-health--unknown">
                {t('dashboard.health.loading')}
              </span>
            ) : (
              <span
                className={`automation-health automation-health--${health ?? 'unknown'}`}
              >
                {installationHealthLabel(health ?? 'unknown', t)}
              </span>
            )}
            <span className="automation-status-mode">
              {t(INSTALLATION_MODE_KEYS[installation.config.rule.mode])}
            </span>
          </div>
          <h2>{installation.shelly.name}</h2>
        </div>
        <RefreshIconButton
          busy={query.isFetching || control.isFetching}
          label={t('common.refresh')}
          onRefresh={refresh}
        />
      </header>

      <div className="automation-metrics" aria-label={t('dashboard.currentValues')}>
        <div>
          <span>{t('dashboard.temperature')}</span>
          <strong>
            {formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')}
          </strong>
        </div>
        <div>
          <span>{t('dashboard.humidity')}</span>
          <strong>
            {formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')}
          </strong>
        </div>
        <div>
          <span>{t('dashboard.vpd')}</span>
          <strong>
            {formatInstallationMetric(snapshot?.diagnostics.lastVpd, ' kPa', 2)}
          </strong>
        </div>
      </div>

      <dl className="automation-summary">
        <div>
          <dt>{t('dashboard.output')}</dt>
          <dd>{relayState == null ? '—' : relayState ? 'ON' : 'OFF'}</dd>
        </div>
        <div>
          <dt>{t('dashboard.thresholds')}</dt>
          <dd>
            {installationThresholdSummary(
              installation,
              snapshot?.diagnostics.lastEffectiveOnThreshold,
              snapshot?.diagnostics.lastEffectiveOffThreshold
            )}
          </dd>
        </div>
        <div>
          <dt>{t('dashboard.sensor')}</dt>
          <dd>{installation.config.sensor.displayName}</dd>
        </div>
      </dl>

      <footer className="automation-card__footer">
        <span>
          {query.isError
            ? t('dashboard.readFailed')
            : query.isFetching
              ? t('dashboard.refreshing')
              : t('dashboard.liveFromShelly')}
        </span>
        <div className="automation-card__actions">
          <div className="automation-card__controls">
            <div
              className="automation-control-group"
              role="group"
              aria-label={t('detail.automation')}
            >
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={controlsVerified && controlStatus?.automationMode === 'auto'}
                disabled={action.isPending || !controlsVerified}
                onClick={() => {
                  if (controlStatus?.automationMode !== 'auto') action.mutate('auto');
                }}
              >
                AUTO
              </button>
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={manualControl}
                disabled={action.isPending || !controlsVerified}
                onClick={() => {
                  if (controlStatus?.automationMode !== 'manual') action.mutate('manual');
                }}
              >
                MANUAL
              </button>
            </div>
            <div
              className="automation-control-group"
              role="group"
              aria-label={t('dashboard.output')}
            >
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={manualControl && controlStatus?.relayOn === true}
                disabled={action.isPending || !manualControl}
                onClick={() => {
                  if (!controlStatus?.relayOn) action.mutate('on');
                }}
              >
                ON
              </button>
              <button
                className="automation-control-button"
                type="button"
                aria-pressed={manualControl && controlStatus?.relayOn === false}
                disabled={action.isPending || !manualControl}
                onClick={() => {
                  if (controlStatus?.relayOn) action.mutate('off');
                }}
              >
                OFF
              </button>
            </div>
          </div>
          <button
            className="secondary-action"
            type="button"
            onClick={() => onOpen(installation.id)}
          >
            {t('dashboard.openSystem')}
          </button>
        </div>
        {action.isError && (
          <span className="automation-control-error" role="alert">
            {t('detail.actionFailed')}
          </span>
        )}
      </footer>
    </article>
  );
};
'''
text = text[:start] + new_card + text[end:]
old_zero = """      {installations.length === 0 ? (\n        <section className=\"demo-panel dashboard-empty\">\n          <h2>{t('dashboard.emptyTitle')}</h2>\n          <p>{t('dashboard.emptyDescription')}</p>\n          <div className=\"action-row\">\n            <button className=\"primary-action\" type=\"button\" onClick={onAddAutomation}>\n              {t('dashboard.configureFirst')}\n            </button>\n          </div>\n        </section>\n      ) : (\n        <section className=\"dashboard-grid\" aria-label={t('dashboard.systemsLabel')}>\n          {installations.map((installation) => (\n            <AutomationCard\n              key={installation.id}\n              installation={installation}\n              onOpen={onOpenInstallation}\n            />\n          ))}\n        </section>\n      )}\n"""
new_zero = """      <section className=\"dashboard-grid\" aria-label={t('dashboard.systemsLabel')}>\n        {installations.map((installation) => (\n          <AutomationCard\n            key={installation.id}\n            installation={installation}\n            onOpen={onOpenInstallation}\n          />\n        ))}\n      </section>\n"""
if old_zero not in text:
    raise SystemExit('dashboard zero-state marker missing')
text = text.replace(old_zero, new_zero, 1)
dashboard.write_text(text)

app_shell = Path('apps/mobile/src/app/appShell.css')
replace_once(
    app_shell,
    ".app-shell > .demo-shell {\n  padding-top: calc(\n    var(--lcl-fluid-shell-padding) + var(--lcl-size-control-min-height) +\n      var(--lcl-spacing-sm)\n  );\n}\n",
    ".app-shell > .demo-shell > .demo-header {\n  padding-right: calc(\n    var(--lcl-size-control-min-height) + var(--lcl-spacing-sm)\n  );\n}\n",
)

theme = Path('apps/mobile/src/theme/theme.css')
text = theme.read_text()
marker = """.automation-card__actions,\n.installation-detail-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: var(--lcl-spacing-sm);\n  justify-content: flex-end;\n}\n\n"""
addition = marker + """.automation-card__controls {\n  align-items: center;\n  display: flex;\n  flex-wrap: wrap;\n  gap: var(--lcl-spacing-sm);\n}\n\n.automation-control-group {\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-md);\n  display: inline-flex;\n  overflow: hidden;\n}\n\n.automation-control-button {\n  background: var(--lcl-color-surface);\n  border: 0;\n  border-right: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  color: var(--lcl-color-text);\n  cursor: pointer;\n  font-size: var(--lcl-font-size-sm);\n  font-weight: 800;\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding: 0 var(--lcl-spacing-sm);\n}\n\n.automation-control-button:last-child {\n  border-right: 0;\n}\n\n.automation-control-button[aria-pressed='true'] {\n  background: var(--lcl-color-accent);\n  color: var(--lcl-color-accent-contrast);\n}\n\n.automation-control-button:disabled {\n  cursor: not-allowed;\n  opacity: var(--lcl-opacity-disabled);\n}\n\n.automation-control-error {\n  color: var(--lcl-color-status-danger-text);\n  flex-basis: 100%;\n  font-size: var(--lcl-font-size-sm);\n}\n\n"""
if marker not in text:
    raise SystemExit('theme action marker missing')
text = text.replace(marker, addition, 1)
theme.write_text(text)

rt_test = Path('apps/mobile/src/flows/installations/runtimeControl.test.ts')
text = rt_test.read_text()
text = text.replace("  startScript: vi.fn(),\n  setRelayOff: vi.fn(),", "  startScript: vi.fn(),\n  setRelayOn: vi.fn(),\n  setRelayOff: vi.fn(),", 1)
text = text.replace("      startScript: mocks.startScript,\n      setRelayOff: mocks.setRelayOff,", "      startScript: mocks.startScript,\n      setRelayOn: mocks.setRelayOn,\n      setRelayOff: mocks.setRelayOff,", 1)
text = text.replace("  pauseInstalledAutomation,\n  resumeInstalledAutomation", "  pauseInstalledAutomation,\n  resumeInstalledAutomation,\n  setInstalledAutomationRelayState", 1)
text = text.replace("    mocks.startScript.mockResolvedValue({ ok: true, value: null });\n    mocks.setRelayOff", "    mocks.startScript.mockResolvedValue({ ok: true, value: null });\n    mocks.setRelayOn.mockResolvedValue({ ok: true, value: null });\n    mocks.setRelayOff", 1)
needle = """  it('resumes from a known OFF state and confirms the stored script is running', async () => {\n    mocks.readControlStatus.mockResolvedValue(controlStatus('auto', 7, false));\n\n    const result = await resumeInstalledAutomation(installation);\n\n    expect(mocks.setRelayOff).toHaveBeenCalledWith({ relayId: 0 });\n    expect(mocks.startScript).toHaveBeenCalledWith(7);\n    expect(result.automationMode).toBe('auto');\n  });\n"""
replacement = """  it('resumes from a known OFF state and confirms the stored script is running', async () => {\n    mocks.readControlStatus\n      .mockResolvedValueOnce(controlStatus('manual', 7, false))\n      .mockResolvedValueOnce(controlStatus('auto', 7, false));\n\n    const result = await resumeInstalledAutomation(installation);\n\n    expect(mocks.setRelayOff).toHaveBeenCalledWith({ relayId: 0 });\n    expect(mocks.startScript).toHaveBeenCalledWith(7);\n    expect(result.automationMode).toBe('auto');\n  });\n\n  it('rejects pause when the stored script id no longer matches Shelly', async () => {\n    mocks.readControlStatus.mockResolvedValue(controlStatus('auto', 8, false));\n\n    await expect(pauseInstalledAutomation(installation)).rejects.toThrow(\n      'Stored automation script does not match Shelly.'\n    );\n    expect(mocks.stopScript).not.toHaveBeenCalled();\n    expect(mocks.setRelayOff).not.toHaveBeenCalled();\n  });\n\n  it('rejects resume when the stored script id no longer matches Shelly', async () => {\n    mocks.readControlStatus.mockResolvedValue(controlStatus('manual', 8, false));\n\n    await expect(resumeInstalledAutomation(installation)).rejects.toThrow(\n      'Stored automation script does not match Shelly.'\n    );\n    expect(mocks.startScript).not.toHaveBeenCalled();\n    expect(mocks.setRelayOff).not.toHaveBeenCalled();\n  });\n\n  it('allows direct relay ON only while the matched automation is manual and verifies it', async () => {\n    mocks.readControlStatus\n      .mockResolvedValueOnce(controlStatus('manual', 7, false))\n      .mockResolvedValueOnce(controlStatus('manual', 7, true));\n\n    const result = await setInstalledAutomationRelayState(installation, true);\n\n    expect(mocks.setRelayOn).toHaveBeenCalledWith({ relayId: 0 });\n    expect(result.relayOn).toBe(true);\n    expect(result.automationMode).toBe('manual');\n  });\n\n  it('rejects direct relay control while automation is running', async () => {\n    mocks.readControlStatus.mockResolvedValue(controlStatus('auto', 7, false));\n\n    await expect(setInstalledAutomationRelayState(installation, true)).rejects.toThrow(\n      'Manual relay control requires a paused automation.'\n    );\n    expect(mocks.setRelayOn).not.toHaveBeenCalled();\n  });\n"""
if needle not in text:
    raise SystemExit('runtime test resume marker missing')
text = text.replace(needle, replacement, 1)
rt_test.write_text(text)

dash_test = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
text = dash_test.read_text()
text = text.replace("expect(screen.getByText('ON')).toBeVisible();", "expect(screen.getAllByText('ON').length).toBeGreaterThanOrEqual(1);", 1)
dash_test.write_text(text)

controls_test = Path('apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx')
controls_test.write_text(r'''import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createDefaultShellyThermostatConfig } from '@lcl/script-generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../app/i18n.js';
import { createInstalledAutomation } from '../flows/installations/model.js';
import {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from '../flows/installations/store.js';

const runtimeMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  diagnosticsRefetch: vi.fn(),
  controlRefetch: vi.fn()
}));

vi.mock('../flows/installations/useInstalledAutomationRuntime.js', () => ({
  useInstalledAutomationDiagnostics: () => ({
    data: undefined,
    isError: true,
    isPending: false,
    isFetching: false,
    refetch: runtimeMocks.diagnosticsRefetch
  }),
  useInstalledAutomationControl: () => ({
    data: {
      relayOn: false,
      automationMode: 'manual',
      automationScriptId: 7,
      firmwareId: '1.0.0',
      telemetry: {},
      clock: { timeSynced: false }
    },
    isError: false,
    isPending: false,
    isFetching: false,
    refetch: runtimeMocks.controlRefetch
  }),
  useInstalledAutomationActions: () => ({
    mutate: runtimeMocks.mutate,
    isPending: false,
    isError: false
  })
}));

import { AutomationDashboardScreen } from '../screens/AutomationDashboardScreen.js';

const installation = createInstalledAutomation({
  shelly: { id: 'shelly-controls', model: 'S3PL-00112EU', gen: 3 },
  shellyName: 'Salon',
  baseUrl: 'http://192.168.0.20/',
  scriptId: 7,
  scriptHash: 'hash',
  config: createDefaultShellyThermostatConfig('xiaomi_lywsd03mmc_bthome_v2', 'heating'),
  nowMs: 1000
});

describe('AutomationDashboardScreen controls', () => {
  beforeEach(() => {
    setLocalePreference('pl');
    resetInstalledAutomationStore();
    runtimeMocks.mutate.mockReset();
    useInstalledAutomationStore.getState().upsertInstallation(installation);
  });

  afterEach(() => {
    cleanup();
    resetInstalledAutomationStore();
  });

  it('shows verified AUTO/MANUAL and ON/OFF controls and routes safe actions', () => {
    render(
      <I18nProvider>
        <AutomationDashboardScreen onAddAutomation={vi.fn()} onOpenInstallation={vi.fn()} />
      </I18nProvider>
    );

    const manual = screen.getByRole('button', { name: 'MANUAL' });
    const auto = screen.getByRole('button', { name: 'AUTO' });
    const on = screen.getByRole('button', { name: 'ON' });
    const off = screen.getByRole('button', { name: 'OFF' });

    expect(manual).toHaveAttribute('aria-pressed', 'true');
    expect(off).toHaveAttribute('aria-pressed', 'true');
    expect(on).toBeEnabled();

    fireEvent.click(auto);
    expect(runtimeMocks.mutate).toHaveBeenCalledWith('auto');

    fireEvent.click(on);
    expect(runtimeMocks.mutate).toHaveBeenCalledWith('on');
  });
});
''')

print('dashboard controls/header patch applied')
