from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'missing marker in {path}: {old[:120]!r}')
    path.write_text(text.replace(old, new, 1))


dashboard = Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
text = dashboard.read_text()
if "from '@tanstack/react-query'" not in text:
    text = "import { useIsFetching, useQueryClient } from '@tanstack/react-query';\nimport { useEffect, useState } from 'react';\n" + text

old_refresh_fn = """  const refresh = () => {\n    void Promise.all([query.refetch(), control.refetch()]);\n  };\n\n"""
if old_refresh_fn not in text:
    raise SystemExit('climate refresh function marker missing')
text = text.replace(old_refresh_fn, '', 1)

old_card_refresh = """        <RefreshIconButton\n          busy={query.isFetching || control.isFetching}\n          label={t('common.refresh')}\n          onRefresh={refresh}\n        />\n"""
if old_card_refresh not in text:
    raise SystemExit('climate card refresh marker missing')
text = text.replace(old_card_refresh, '', 1)

old_output_summary = """        <div>\n          <dt>{t('dashboard.output')}</dt>\n          <dd>{relayState == null ? '—' : relayState ? 'ON' : 'OFF'}</dd>\n        </div>\n"""
if old_output_summary not in text:
    raise SystemExit('relay summary marker missing')
text = text.replace(old_output_summary, '', 1)

footer_start = text.index('      <footer className="automation-card__footer">')
footer_end = text.index('      </footer>', footer_start) + len('      </footer>')
new_footer = r'''      <footer className="automation-card__footer">
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
            className="automation-relay-actions"
            role="group"
            aria-label={t('dashboard.output')}
          >
            <button
              className="automation-relay-button"
              type="button"
              aria-pressed={relayState === true}
              disabled={action.isPending || !manualControl}
              onClick={() => {
                if (!controlStatus?.relayOn) action.mutate('on');
              }}
            >
              ON
            </button>
            <button
              className="automation-relay-button"
              type="button"
              aria-pressed={relayState === false}
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
          className="automation-card__detail-link"
          type="button"
          onClick={() => onOpen(installation.id)}
        >
          <span>{t('dashboard.openSystem')}</span>
          <span aria-hidden="true">›</span>
        </button>
        {action.isError && (
          <span className="automation-control-error" role="alert">
            {t('detail.actionFailed')}
          </span>
        )}
      </footer>'''
text = text[:footer_start] + new_footer + text[footer_end:]

old_component_setup = """  const { t } = useTranslation();\n  const installations = useInstalledAutomationStore((state) => state.installations);\n\n  return (\n"""
new_component_setup = """  const { t } = useTranslation();\n  const installations = useInstalledAutomationStore((state) => state.installations);\n  const queryClient = useQueryClient();\n  const hasClimate = installations.some((installation) => installation.kind !== 'time');\n  const hasTime = installations.some((installation) => installation.kind === 'time');\n  const [activeKind, setActiveKind] = useState<'climate' | 'time'>(() =>\n    hasClimate ? 'climate' : 'time'\n  );\n\n  useEffect(() => {\n    if (activeKind === 'climate' && !hasClimate && hasTime) {\n      setActiveKind('time');\n    } else if (activeKind === 'time' && !hasTime && hasClimate) {\n      setActiveKind('climate');\n    }\n  }, [activeKind, hasClimate, hasTime]);\n\n  const isDashboardRuntimeQuery = (query: { queryKey: readonly unknown[] }) => {\n    const root = query.queryKey[0];\n    return (\n      root === 'installed-automation-diagnostics' ||\n      root === 'installed-automation-control' ||\n      root === 'time-automation-runtime'\n    );\n  };\n  const activeRefreshes = useIsFetching({ predicate: isDashboardRuntimeQuery });\n  const refreshAll = () => {\n    void queryClient.refetchQueries({ predicate: isDashboardRuntimeQuery });\n  };\n  const visibleInstallations = installations.filter((installation) =>\n    activeKind === 'time' ? installation.kind === 'time' : installation.kind !== 'time'\n  );\n\n  return (\n"""
if old_component_setup not in text:
    raise SystemExit('dashboard component setup marker missing')
text = text.replace(old_component_setup, new_component_setup, 1)

old_header = """      <header className=\"demo-header dashboard-header\">\n        <div>\n          <h1>{t('dashboard.title')}</h1>\n        </div>\n        <button\n          className=\"primary-action dashboard-add-action\"\n          type=\"button\"\n          onClick={onAddAutomation}\n        >\n          {t('dashboard.addAutomation')}\n        </button>\n      </header>\n\n      <section className=\"dashboard-grid\" aria-label={t('dashboard.systemsLabel')}>\n        {installations.map((installation) => (\n"""
new_header = """      <header className=\"demo-header dashboard-header\">\n        <div>\n          <h1>{t('dashboard.title')}</h1>\n        </div>\n        <RefreshIconButton\n          busy={activeRefreshes > 0}\n          className=\"dashboard-refresh-action\"\n          label={t('common.refresh')}\n          onRefresh={refreshAll}\n        />\n      </header>\n\n      <div className=\"dashboard-kind-tabs\" role=\"tablist\" aria-label={t('dashboard.systemsLabel')}>\n        <button\n          className=\"dashboard-kind-tab\"\n          type=\"button\"\n          role=\"tab\"\n          aria-selected={activeKind === 'climate'}\n          disabled={!hasClimate}\n          onClick={() => setActiveKind('climate')}\n        >\n          {t('dashboard.climateTab')}\n        </button>\n        <button\n          className=\"dashboard-kind-tab\"\n          type=\"button\"\n          role=\"tab\"\n          aria-selected={activeKind === 'time'}\n          disabled={!hasTime}\n          onClick={() => setActiveKind('time')}\n        >\n          {t('dashboard.timeTab')}\n        </button>\n      </div>\n\n      <section className=\"dashboard-grid\" aria-label={t('dashboard.systemsLabel')}>\n        {visibleInstallations.map((installation) => (\n"""
if old_header not in text:
    raise SystemExit('dashboard header marker missing')
text = text.replace(old_header, new_header, 1)

old_end = """      </section>\n    </main>\n  );\n};\n"""
new_end = """      </section>\n\n      <button\n        className=\"dashboard-fab\"\n        type=\"button\"\n        aria-label={t('dashboard.addAutomation')}\n        title={t('dashboard.addAutomation')}\n        onClick={onAddAutomation}\n      >\n        <svg aria-hidden=\"true\" className=\"dashboard-fab__icon\" viewBox=\"0 0 24 24\">\n          <path d=\"M12 5v14M5 12h14\" />\n        </svg>\n      </button>\n    </main>\n  );\n};\n"""
if old_end not in text:
    raise SystemExit('dashboard end marker missing')
text = text.replace(old_end, new_end, 1)
dashboard.write_text(text)

refresh = Path('apps/mobile/src/components/RefreshIconButton.tsx')
text = refresh.read_text()
text = text.replace(
    """type RefreshIconButtonProps = {\n  busy: boolean;\n  label: string;\n  onRefresh(): void;\n};\n\nexport const RefreshIconButton = ({ busy, label, onRefresh }: RefreshIconButtonProps) => (\n""",
    """type RefreshIconButtonProps = {\n  busy: boolean;\n  className?: string;\n  label: string;\n  onRefresh(): void;\n};\n\nexport const RefreshIconButton = ({\n  busy,\n  className,\n  label,\n  onRefresh\n}: RefreshIconButtonProps) => (\n""",
    1,
)
old_class = '    className="icon-action runtime-refresh-action"\n'
new_class = "    className={`icon-action runtime-refresh-action${className ? ` ${className}` : ''}`}\n"
if old_class not in text:
    raise SystemExit('refresh class marker missing')
text = text.replace(old_class, new_class, 1)
refresh.write_text(text)

time_card = Path('apps/mobile/src/screens/TimeAutomationCard.tsx')
text = time_card.read_text()
text = text.replace("import { RefreshIconButton } from '../components/RefreshIconButton.js';\n", '', 1)
old_time_refresh = """        <RefreshIconButton\n          busy={query.isFetching}\n          label={t('common.refresh')}\n          onRefresh={() => void query.refetch()}\n        />\n"""
if old_time_refresh not in text:
    raise SystemExit('time refresh marker missing')
text = text.replace(old_time_refresh, '', 1)
time_footer_start = text.index('      <footer className="automation-card__footer">')
time_footer_end = text.index('      </footer>', time_footer_start) + len('      </footer>')
new_time_footer = r'''      <footer className="automation-card__footer">
        <button
          className="automation-card__detail-link"
          type="button"
          onClick={() => onOpen(installation.id)}
        >
          <span>{t('dashboard.openSystem')}</span>
          <span aria-hidden="true">›</span>
        </button>
      </footer>'''
text = text[:time_footer_start] + new_time_footer + text[time_footer_end:]
time_card.write_text(text)

app_shell = Path('apps/mobile/src/app/appShell.css')
text = app_shell.read_text()
old_shell_header = """.app-shell > .demo-shell > .demo-header {\n  padding-right: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-sm));\n}\n"""
new_shell_header = """.app-shell > .demo-shell > .demo-header {\n  padding-right: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-sm));\n}\n\n.app-shell > .dashboard-shell > .dashboard-header {\n  padding-right: calc(\n    var(--lcl-size-control-min-height) + var(--lcl-size-control-min-height) +\n      var(--lcl-spacing-sm) + var(--lcl-spacing-sm)\n  );\n}\n"""
if old_shell_header not in text:
    raise SystemExit('app shell header marker missing')
text = text.replace(old_shell_header, new_shell_header, 1)
text = text.replace('  background: var(--lcl-color-surface);\n', '  background: transparent;\n', 1)
text = text.replace('  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n', '  border: var(--lcl-border-width-sm) solid transparent;\n', 1)
text = text.replace('  box-shadow: var(--lcl-shadow-md);\n', '  box-shadow: none;\n', 1)
app_shell.write_text(text)

css = Path('apps/mobile/src/theme/theme.css')
text = css.read_text()
old_mobile = """@media (max-width: 30rem) {\n  .dashboard-header {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .dashboard-header .primary-action {\n    width: 100%;\n  }\n\n  .automation-health {\n    align-self: flex-start;\n  }\n}\n"""
new_mobile = """@media (max-width: 30rem) {\n  .automation-health {\n    align-self: flex-start;\n  }\n}\n"""
if old_mobile not in text:
    raise SystemExit('dashboard mobile marker missing')
text = text.replace(old_mobile, new_mobile, 1)

append_marker = "\n.installation-detail-shell {\n"
polish_css = r'''
.dashboard-shell {
  gap: var(--lcl-spacing-md);
  padding-bottom: calc(
    var(--lcl-fluid-shell-padding) + var(--lcl-size-control-min-height) +
      var(--lcl-spacing-xl)
  );
}

.dashboard-header {
  align-items: center;
  min-height: var(--lcl-size-control-min-height);
  position: relative;
}

.dashboard-refresh-action {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  position: absolute;
  right: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-sm));
  top: 0;
}

.dashboard-kind-tabs {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  display: grid;
  gap: var(--lcl-spacing-xs);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: var(--lcl-spacing-xs);
}

.dashboard-kind-tab {
  background: transparent;
  border: 0;
  border-radius: calc(var(--lcl-radius-md) - var(--lcl-spacing-xs));
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  font-weight: 800;
  min-height: var(--lcl-size-compact-control-min-height);
  padding: 0 var(--lcl-spacing-md);
}

.dashboard-kind-tab[aria-selected='true'] {
  background: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}

.dashboard-kind-tab:disabled {
  cursor: default;
  opacity: var(--lcl-opacity-disabled);
}

.dashboard-grid {
  gap: var(--lcl-spacing-md);
}

.automation-card {
  box-shadow: none;
  gap: var(--lcl-spacing-sm);
  padding: var(--lcl-spacing-md);
}

.automation-card__header {
  gap: var(--lcl-spacing-sm);
}

.automation-metrics {
  border-bottom: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  gap: 0;
  grid-template-columns: minmax(0, 1.35fr) repeat(2, minmax(0, 0.85fr));
  padding: var(--lcl-spacing-sm) 0;
}

.automation-metrics > div {
  background: transparent;
  border-radius: 0;
  border-right: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  padding: 0 var(--lcl-spacing-sm);
}

.automation-metrics > div:first-child {
  padding-left: 0;
}

.automation-metrics > div:last-child {
  border-right: 0;
  padding-right: 0;
}

.automation-metrics > div:first-child strong {
  font-size: var(--lcl-fluid-hero-title);
}

.automation-summary {
  gap: var(--lcl-spacing-sm) var(--lcl-spacing-md);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.automation-summary > div {
  align-items: start;
  display: grid;
  gap: var(--lcl-spacing-xs);
  justify-content: start;
}

.automation-summary dd {
  font-size: var(--lcl-font-size-sm);
  max-width: none;
  text-align: left;
}

.automation-card__footer {
  display: grid;
  gap: var(--lcl-spacing-sm);
  padding-top: var(--lcl-spacing-sm);
}

.automation-card__controls {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  width: 100%;
}

.automation-control-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.automation-relay-actions {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.automation-relay-button {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid transparent;
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text);
  cursor: pointer;
  font-weight: 800;
  min-height: var(--lcl-size-control-min-height);
}

.automation-relay-button[aria-pressed='true'] {
  background: var(--lcl-color-accent);
  color: var(--lcl-color-accent-contrast);
}

.automation-relay-button:disabled {
  cursor: not-allowed;
  opacity: var(--lcl-opacity-disabled);
}

.automation-card__detail-link {
  align-items: center;
  background: transparent;
  border: 0;
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  display: flex;
  font-size: var(--lcl-font-size-sm);
  font-weight: 700;
  justify-content: space-between;
  min-height: var(--lcl-size-compact-control-min-height);
  padding: var(--lcl-spacing-sm) 0 0;
  text-align: left;
  width: 100%;
}

.dashboard-fab {
  align-items: center;
  align-self: end;
  background: var(--lcl-color-accent);
  border: 0;
  border-radius: var(--lcl-radius-pill);
  box-shadow: var(--lcl-shadow-md);
  color: var(--lcl-color-accent-contrast);
  cursor: pointer;
  display: inline-flex;
  height: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-sm));
  justify-content: center;
  justify-self: end;
  width: calc(var(--lcl-size-control-min-height) + var(--lcl-spacing-sm));
}

.dashboard-fab__icon {
  fill: none;
  height: var(--lcl-size-control-icon-size);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  width: var(--lcl-size-control-icon-size);
}

@media (max-width: 48rem) {
  .dashboard-fab {
    bottom: calc(var(--lcl-spacing-lg) + env(safe-area-inset-bottom));
    position: fixed;
    right: var(--lcl-fluid-shell-padding);
    z-index: 18;
  }
}

@media (max-width: 30rem) {
  .automation-card__controls {
    grid-template-columns: 1fr;
  }

  .automation-control-group {
    justify-self: end;
    width: min(100%, var(--lcl-size-card-column-min));
  }
}
'''
if append_marker not in text:
    raise SystemExit('theme insertion marker missing')
text = text.replace(append_marker, '\n' + polish_css + append_marker, 1)
css.write_text(text)

translations = {
    'pl.ts': ('Klimat', 'Czas'),
    'en.ts': ('Climate', 'Time'),
    'de.ts': ('Klima', 'Zeit'),
    'es.ts': ('Clima', 'Tiempo'),
    'fr.ts': ('Climat', 'Temps'),
    'it.ts': ('Clima', 'Tempo'),
    'ptBr.ts': ('Clima', 'Tempo'),
}
for filename, (climate_label, time_label) in translations.items():
    path = Path('apps/mobile/src/app/locales') / filename
    text = path.read_text()
    marker = "  dashboard: {\n    title: "
    pos = text.find(marker)
    if pos < 0:
        raise SystemExit(f'dashboard locale marker missing in {filename}')
    title_end = text.find('\n', pos + len(marker))
    insert_at = title_end + 1
    if '    climateTab:' not in text[pos:text.find('  },', pos)]:
        text = text[:insert_at] + f"    climateTab: '{climate_label}',\n    timeTab: '{time_label}',\n" + text[insert_at:]
    path.write_text(text)

# Focused test assertions for the new dashboard family switch.
test = Path('apps/mobile/src/__tests__/automation-dashboard.test.tsx')
text = test.read_text()
climate_assert = """    expect(screen.getByText('19°C / 20°C')).toBeVisible();\n    expect(screen.getByRole('button', { name: 'Szczegóły' })).toBeVisible();\n"""
climate_repl = """    expect(screen.getByText('19°C / 20°C')).toBeVisible();\n    expect(screen.getByRole('tab', { name: 'Klimat' })).toHaveAttribute(\n      'aria-selected',\n      'true'\n    );\n    expect(screen.getByRole('tab', { name: 'Czas' })).toBeDisabled();\n    expect(screen.getByRole('button', { name: 'Szczegóły' })).toBeVisible();\n"""
if climate_assert not in text:
    raise SystemExit('climate tab test marker missing')
text = text.replace(climate_assert, climate_repl, 1)
time_assert = """    expect(await screen.findByText('Działa')).toBeVisible();\n    expect(screen.getByText('ON')).toBeVisible();\n\n    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły' }));\n"""
time_repl = """    expect(await screen.findByText('Działa')).toBeVisible();\n    expect(screen.getByText('ON')).toBeVisible();\n    expect(screen.getByRole('tab', { name: 'Czas' })).toHaveAttribute(\n      'aria-selected',\n      'true'\n    );\n    expect(screen.getByRole('tab', { name: 'Klimat' })).toBeDisabled();\n\n    fireEvent.click(screen.getByRole('button', { name: 'Szczegóły' }));\n"""
if time_assert not in text:
    raise SystemExit('time tab test marker missing')
text = text.replace(time_assert, time_repl, 1)
test.write_text(text)

print('dashboard visual polish v2 applied')
