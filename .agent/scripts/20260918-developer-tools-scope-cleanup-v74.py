from pathlib import Path
import re

ROOT = Path('.')


def path(rel: str) -> Path:
    return ROOT / rel


def read(rel: str) -> str:
    return path(rel).read_text()


def write(rel: str, text: str) -> None:
    path(rel).write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    next_text, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex replacement, found {count}')
    return next_text


# Rule setup: developer tools are setup-only script inspection/recovery actions.
rel = 'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx'
text = read(rel)
text = replace_once(text, "import { IconTrash } from '@tabler/icons-react';\n", '', 'remove rule trash import')
text = replace_once(
    text,
    "type RuleSetupPageProps = HardwarePageProps<RuleSetupFlow> & {\n  selectablePresets?: readonly RulePresetId[];\n  showShellySelector?: boolean;\n  onOpenDiagnostics?: () => void;\n};",
    "type RuleSetupPageProps = HardwarePageProps<RuleSetupFlow> & {\n  selectablePresets?: readonly RulePresetId[];\n  showShellySelector?: boolean;\n};",
    'remove diagnostics prop type'
)
text = replace_once(
    text,
    "export const RuleSetupPage = ({\n  flow,\n  selectablePresets = ALL_RULE_PRESETS,\n  showShellySelector = true,\n  onOpenDiagnostics\n}: RuleSetupPageProps) => {",
    "export const RuleSetupPage = ({\n  flow,\n  selectablePresets = ALL_RULE_PRESETS,\n  showShellySelector = true\n}: RuleSetupPageProps) => {",
    'remove diagnostics prop destructure'
)
text = replace_once(
    text,
    "  const isScriptActionBusy =\n    flow.loadAutomationScriptMutation.isPending ||\n    flow.deleteAutomationScriptMutation.isPending;",
    "  const isScriptActionBusy = flow.loadAutomationScriptMutation.isPending;",
    'narrow script busy state'
)
text = replace_once(
    text,
    "\n  const deleteManagedScript = () => {\n    if (!flow.selectedShelly) {\n      return;\n    }\n    flow.deleteAutomationScript(flow.selectedShelly);\n  };\n",
    '',
    'remove setup delete handler'
)
old_dev = '''        <details className="rule-progressive-disclosure rule-progressive-disclosure--developer">
          <summary>{t('hardware.rule.developerTools')}</summary>
          <div className="rule-progressive-disclosure__body">
            <p>{t('hardware.rule.developerToolsHint')}</p>
            <div className="action-row rule-developer-actions">
              <button
                className="secondary-action"
                type="button"
                disabled={!flow.configState.ok}
                title={t('hardware.rule.scriptPreviewTitle')}
                onClick={() => setDialog('script')}
              >
                <CodeIcon />
                {t('hardware.rule.scriptPreview')}
              </button>
              <button
                className="secondary-action"
                type="button"
                aria-busy={flow.loadAutomationScriptMutation.isPending}
                disabled={!flow.selectedShelly || isScriptActionBusy}
                title={t('hardware.rule.loadScriptFromShellyTitle')}
                onClick={loadScriptFromShelly}
              >
                {flow.loadAutomationScriptMutation.isPending
                  ? t('hardware.rule.loadingScriptFromShelly')
                  : t('hardware.rule.loadScriptFromShelly')}
              </button>
              <button
                className="secondary-action secondary-action--danger"
                type="button"
                disabled={!flow.selectedShelly || isScriptActionBusy}
                title={t('hardware.rule.deleteScriptTitle')}
                onClick={() => setDialog('delete')}
              >
                <IconTrash className="icon-action__svg" aria-hidden="true" />
                {t('hardware.rule.deleteScriptFromShelly')}
              </button>
              {onOpenDiagnostics && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={onOpenDiagnostics}
                >
                  {t('hardware.rule.openDeveloperDiagnostics')}
                </button>
              )}
            </div>
          </div>
        </details>'''
new_dev = '''        <details className="rule-progressive-disclosure rule-progressive-disclosure--developer">
          <summary>{t('hardware.rule.developerTools')}</summary>
          <div className="rule-progressive-disclosure__body">
            <div className="action-row rule-developer-actions rule-developer-actions--compact">
              <button
                className="secondary-action"
                type="button"
                disabled={!flow.configState.ok}
                title={t('hardware.rule.scriptPreviewTitle')}
                onClick={() => setDialog('script')}
              >
                <CodeIcon />
                {t('hardware.rule.scriptPreview')}
              </button>
              <button
                className="secondary-action"
                type="button"
                aria-busy={flow.loadAutomationScriptMutation.isPending}
                disabled={!flow.selectedShelly || isScriptActionBusy}
                title={t('hardware.rule.loadScriptFromShellyTitle')}
                onClick={loadScriptFromShelly}
              >
                {flow.loadAutomationScriptMutation.isPending
                  ? t('hardware.rule.loadingScriptFromShelly')
                  : t('hardware.rule.loadScriptFromShelly')}
              </button>
            </div>
          </div>
        </details>'''
text = replace_once(text, old_dev, new_dev, 'replace developer tools actions')
text = regex_once(
    text,
    r'''\n      <Modal\n        actions=\{\n          <button\n            className="secondary-action secondary-action--danger"[\s\S]*?\n      </Modal>(?=\n      <ToastViewport)''',
    '',
    'remove setup script delete modal'
)
write(rel, text)

# Rule feedback no longer owns setup-time delete behavior.
rel = 'apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts'
text = read(rel)
text = replace_once(
    text,
    "export type RuleDialogState =\n  'none' | 'script' | 'delete' | 'install-block' | 'relay-test';",
    "export type RuleDialogState = 'none' | 'script' | 'install-block' | 'relay-test';",
    'remove delete dialog state'
)
text = replace_once(
    text,
    "  useEffect(() => {\n    setDialog((current) => (current === 'delete' ? 'none' : current));\n  }, [flow.selectedShellyId, setDialog]);\n\n",
    '',
    'remove delete selection effect'
)
text = regex_once(
    text,
    r'''\n  useEffect\(\(\) => \{\n    if \(!flow\.deleteAutomationScriptMutation\.isError\)[\s\S]*?\n  \}, \[flow\.deleteAutomationScriptMutation, pushToast, setDialog, t\]\);\n''',
    '\n',
    'remove delete feedback effects'
)
write(rel, text)

# Narrow page contracts: setup diagnostics and setup deletion are gone.
rel = 'apps/mobile/src/screens/hardware-setup/pageContracts.ts'
text = read(rel)
text = text.replace("  | 'deleteAutomationScript'\n", '')
text = text.replace("  | 'deleteAutomationScriptMutation'\n", '')
text = regex_once(
    text,
    r'''\nexport type DiagnosticsSetupFlow = Pick<[\s\S]*?\n>;\n''',
    '\n',
    'remove diagnostics page contract'
)
write(rel, text)

# Hardware setup navigation no longer has a hidden diagnostics pseudo-tab.
rel = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
text = read(rel)
text = replace_once(text, "import { DiagnosticsSetupPage } from './pages/DiagnosticsSetupPage.js';\n", '', 'remove diagnostics page import')
text = replace_once(
    text,
    "type HardwareTabId = PrimaryHardwareTabId | 'diagnostics';",
    "type HardwareTabId = PrimaryHardwareTabId;",
    'narrow hardware tab type'
)
text = replace_once(
    text,
    "  if (hashValue === 'diagnostics' && availableTabs === CLIMATE_HARDWARE_TABS) {\n    return 'diagnostics';\n  }\n",
    '',
    'remove diagnostics hash route'
)
text = regex_once(
    text,
    r'''\n  useEffect\(\(\) => \{\n    if \(activeTab === 'diagnostics'\) \{[\s\S]*?\n  \}, \[activeTab, availableTabs, setupIntent\]\);\n''',
    '\n',
    'remove diagnostics tab recovery effect'
)
text = replace_once(
    text,
    "          showShellySelector={!fixedShellyId}\n          onOpenDiagnostics={() => selectTab('diagnostics')}\n",
    "          showShellySelector={!fixedShellyId}\n",
    'remove rule diagnostics navigation'
)
text = regex_once(
    text,
    r'''\n      \{setupIntent !== 'time' && activeTab === 'diagnostics' && \([\s\S]*?\n      \)\}\n''',
    '\n',
    'remove diagnostics page render'
)
write(rel, text)

# Diagnostic target is no longer persisted separately from the selected plug.
rel = 'apps/mobile/src/flows/hardware-setup/setupDraftStore.ts'
text = read(rel)
for old in [
    "  diagnosticShellyId: z.string().nullable(),\n",
    "  diagnosticShellyId: null,\n",
    "  setDiagnosticShellyId(id: string): void;\n",
    "          diagnosticShellyId: device.id\n",
    "          diagnosticShellyId: id\n",
    "    setDiagnosticShellyId: (diagnosticShellyId) => updateDraft({ diagnosticShellyId }),\n"
]:
    text = text.replace(old, '')
text = regex_once(
    text,
    r'''  diagnosticShellyId:\n    'diagnosticShellyId' in patch\n      \? \(patch\.diagnosticShellyId \?\? null\)\n      : state\.diagnosticShellyId,\n''',
    '',
    'remove persisted diagnostic target'
)
text = regex_once(
    text,
    r'''\n        const nextDiagnosticShellyId =\n          state\.diagnosticShellyId === id\n            \? \(nextSelectedShellyId \?\? shellyDevices\[0\]\?\.id \?\? null\)\n            : state\.diagnosticShellyId;\n''',
    '\n',
    'remove diagnostic removal fallback'
)
text = replace_once(
    text,
    "        return persistPatch(state, {\n          shellyDevices,\n          selectedShellyId: nextSelectedShellyId,\n          diagnosticShellyId: nextDiagnosticShellyId\n        });",
    "        return persistPatch(state, {\n          shellyDevices,\n          selectedShellyId: nextSelectedShellyId\n        });",
    'simplify shelly removal persistence'
)
write(rel, text)

# Hardware setup flow stops composing legacy diagnostics and setup-time delete.
rel = 'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts'
text = read(rel)
text = text.replace('  deleteShellyAutomationScript,\n', '')
text = text.replace('  type ShellyControlStatus\n', '')
text = text.replace("import { useHardwareDiagnosticsFlow } from './useHardwareDiagnosticsFlow.js';\n", '')
text = regex_once(
    text,
    r'''\ntype ShellyAutomationDeleteMutationResult = \{\n  device: ShellyDraftDevice;\n  status: ShellyControlStatus;\n\};\n''',
    '\n',
    'remove setup delete result type'
)
text = regex_once(
    text,
    r'''  const diagnosticShellyId = useHardwareSetupDraftStore\([\s\S]*?\n  \);\n  const setDiagnosticShellyIdDraft = useHardwareSetupDraftStore\([\s\S]*?\n  \);\n''',
    '',
    'remove diagnostic draft selectors'
)
text = replace_once(
    text,
    "    setShellyUrlInputDraft(value);\n    setSetupStatus(null);\n    clearDiagnosticSnapshot();",
    "    setShellyUrlInputDraft(value);\n    setSetupStatus(null);",
    'stop clearing removed diagnostics on URL edit'
)
text = regex_once(
    text,
    r'''  const diagnosticShelly = useMemo\([\s\S]*?\n  \} = useHardwareDiagnosticsFlow\(diagnosticShelly\);\n''',
    '',
    'remove legacy diagnostics composition'
)
text = replace_once(
    text,
    "  } = useClimateAutomationInstallFlow({\n    selectedShelly,\n    configState,\n    isThresholdValid,\n    isVpdAssistValid,\n    refreshDiagnostics\n  });",
    "  } = useClimateAutomationInstallFlow({\n    selectedShelly,\n    configState,\n    isThresholdValid,\n    isVpdAssistValid\n  });",
    'decouple install flow from diagnostics'
)
text = regex_once(
    text,
    r'''\n  const deleteAutomationScriptMutation = useMutation\(\{[\s\S]*?\n  \}\);\n''',
    '\n',
    'remove setup delete mutation'
)
text = replace_once(text, "      clearDiagnosticSnapshot();\n      applyControlStatus(device, state.status, null);", "      applyControlStatus(device, state.status, null);", 'remove load diagnostic clear')
text = replace_once(
    text,
    "\n  const deleteAutomationScript = (device: ShellyDraftDevice) => {\n    deleteAutomationScriptMutation.mutate(device);\n  };\n",
    '',
    'remove setup delete action'
)
text = text.replace('    clearDiagnosticSnapshot();\n', '')
text = regex_once(
    text,
    r'''\n  const setDiagnosticShellyId = \(id: string\) => \{\n    setDiagnosticShellyIdDraft\(id\);\n  \};\n''',
    '\n',
    'remove diagnostic target setter'
)
for old in [
    '    diagnosticShellyId,\n',
    '    setDiagnosticShellyId,\n',
    '    diagnosticShelly,\n',
    '    diagnosticSnapshot,\n',
    '    diagnosticResources,\n',
    '    diagnosticFetchedAtMs,\n',
    '    deleteAutomationScriptMutation,\n',
    '    deleteAutomationScript,\n',
    '    diagnosticMutation,\n',
    '    diagnosticResourceMutation,\n',
    '    refreshDiagnostics\n'
]:
    text = text.replace(old, '')
write(rel, text)

# Install flow owns install/safety only; diagnostics fetch when their own surface opens.
rel = 'apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts'
text = read(rel)
text = replace_once(
    text,
    "  isThresholdValid,\n  isVpdAssistValid,\n  refreshDiagnostics\n}: {\n  selectedShelly: ShellyDraftDevice | null;\n  configState: ClimateConfigState;\n  isThresholdValid: boolean;\n  isVpdAssistValid: boolean;\n  refreshDiagnostics: (scriptId?: number) => void;\n}) => {",
    "  isThresholdValid,\n  isVpdAssistValid\n}: {\n  selectedShelly: ShellyDraftDevice | null;\n  configState: ClimateConfigState;\n  isThresholdValid: boolean;\n  isVpdAssistValid: boolean;\n}) => {",
    'remove diagnostics dependency from install signature'
)
text = replace_once(
    text,
    "    onSuccess: ({ install }) => {\n      setSafeRelayTestState(install);\n      refreshDiagnostics(install.scriptId);\n    }",
    "    onSuccess: ({ install }) => {\n      setSafeRelayTestState(install);\n    }",
    'remove post-test diagnostics refresh'
)
write(rel, text)

# Installed automation diagnostics are the canonical technical workspace and self-refresh.
rel = 'apps/mobile/src/screens/InstallationDiagnosticsModal.tsx'
text = read(rel)
text = replace_once(text, "import { IconRefresh } from '@tabler/icons-react';\n", '', 'remove diagnostics refresh icon')
text = replace_once(
    text,
    "  const missing = t('common.missing');\n  const isRefreshing = diagnosticsQuery.isFetching || resourcesQuery.isFetching;",
    "  const missing = t('common.missing');",
    'remove manual refreshing state'
)
text = regex_once(
    text,
    r'''\n  const refresh = \(\) => \{\n    void Promise\.allSettled\(\[diagnosticsQuery\.refetch\(\), resourcesQuery\.refetch\(\)\]\);\n  \};''',
    '',
    'remove manual diagnostics refresh'
)
text = regex_once(
    text,
    r'''\n      headerActions=\{[\s\S]*?\n      \}\n      open=\{open\}''',
    '\n      open={open}',
    'remove diagnostics header action'
)
text = replace_once(text, '      size="diagnostic"\n', '      size="workspace"\n', 'use workspace diagnostics modal')
write(rel, text)

# Compact the remaining two setup developer actions side by side.
rel = 'apps/mobile/src/theme/theme.css'
text = read(rel)
if '.rule-developer-actions--compact {' in text:
    raise SystemExit('compact developer actions already present')
text += '''\n\n.rule-developer-actions--compact {\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  width: 100%;\n}\n\n.rule-developer-actions--compact .secondary-action {\n  min-width: 0;\n  width: 100%;\n}\n'''
write(rel, text)

# Repository architecture gate follows the new ownership boundary.
rel = 'scripts/quality/repository-gate.mjs'
text = read(rel)
text = text.replace("    'apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts': 350,\n", '')
text = text.replace("    'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx':\n      'DiagnosticsSetupFlow',\n", '')
write(rel, text)

# Architecture notes: diagnostics belong to installed automation runtime, not setup.
rel = 'docs/architecture/refactor-boundaries.md'
text = read(rel)
text = text.replace(
    '- `useHardwareDiagnosticsFlow.ts` owns script diagnostics and resource snapshots.',
    '- installation-scoped runtime queries own automation diagnostics and resource snapshots; setup does not keep a separate diagnostic target.'
)
write(rel, text)

# Remove legacy setup diagnostics implementation and focused unit test.
for rel in [
    'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx',
    'apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts',
    'apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.test.ts'
]:
    target = path(rel)
    if not target.exists():
        raise SystemExit(f'missing legacy diagnostics file: {rel}')
    target.unlink()

# Hardware setup tests: preserve load/preview coverage, remove legacy delete/diagnostic surface coverage.
rel = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
text = read(rel)
text = regex_once(
    text,
    r'''\nconst openRuleDeleteScriptDialog = async \(\) => \{[\s\S]*?\n\};\n\nconst openDeveloperDiagnostics = \(\) => \{[\s\S]*?\n\};\n\nconst confirmRuleScriptDelete = async \(\) => \{[\s\S]*?\n\};\n''',
    '\n',
    'remove legacy diagnostics/delete test helpers'
)
text = replace_once(
    text,
    "    expect(screen.getByRole('button', { name: 'Usuń z Shelly' })).toHaveAttribute(\n      'title',\n      'Usuń skrypt Local Climate Link z Shelly'\n    );\n    expect(\n      screen.getByRole('button', { name: 'Otwórz diagnostykę techniczną' })\n    ).toBeVisible();",
    "    const developerTools = screen\n      .getByText('Narzędzia deweloperskie', { selector: 'summary' })\n      .closest('details');\n    expect(developerTools).not.toBeNull();\n    const developerActions = developerTools!.querySelector('.rule-developer-actions');\n    expect(developerActions).toHaveClass('rule-developer-actions--compact');\n    expect(within(developerActions as HTMLElement).getAllByRole('button')).toHaveLength(2);\n    expect(screen.queryByRole('button', { name: 'Usuń z Shelly' })).not.toBeInTheDocument();\n    expect(\n      screen.queryByRole('button', { name: 'Otwórz diagnostykę techniczną' })\n    ).not.toBeInTheDocument();",
    'assert narrowed developer tools'
)
text = replace_once(
    text,
    "  it('loads a Shelly script into the rule form and deletes it from the main screen', async () => {",
    "  it('loads a Shelly script into the rule form from the selected plug', async () => {",
    'rename load script test'
)
text = regex_once(
    text,
    r'''\n    const deleteDialog = await confirmRuleScriptDelete\(\);[\s\S]*?\n    expect\(deleteDialog\)\.not\.toBeInTheDocument\(\);''',
    '',
    'remove setup delete tail from load test'
)
text = regex_once(
    text,
    r'''\n    await confirmRuleScriptDelete\(\);\n\n    expect\(await screen\.findByText\('Usunięto skrypt Shelly\.'\)\)\.toBeInTheDocument\(\);\n    fireEvent\.click\([\s\S]*?\n      expect\(screen\.queryByText\('Usunięto skrypt Shelly\.'\)\)\.not\.toBeInTheDocument\(\)\n    \);\n''',
    '\n',
    'remove delete toast leg from replay test'
)
# Remove tests whose purpose was the deleted setup diagnostic/delete surfaces.
chunks = text.split('\n  it(')
prefix, rest = chunks[0], chunks[1:]
banned_titles = [
    "sets relay OFF before stopping a script during delete even when Script.Stop fails",
    "reports delete failure separately from confirmed relay OFF safety"
]
kept = []
for chunk in rest:
    if 'openDeveloperDiagnostics();' in chunk:
        continue
    if any(title in chunk for title in banned_titles):
        continue
    kept.append(chunk)
text = prefix + ''.join('\n  it(' + chunk for chunk in kept)
write(rel, text)

# Installation detail test now proves automatic diagnostics refresh and shared workspace sizing.
rel = 'apps/mobile/src/__tests__/automation-detail.test.tsx'
text = read(rel)
text = replace_once(
    text,
    "import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';",
    "import { InstallationDetailScreen } from '../screens/InstallationDetailScreen.js';\nimport { INSTALLATION_DIAGNOSTICS_REFRESH_MS } from '../screens/InstallationDiagnosticsModal.js';",
    'import diagnostics refresh interval'
)
text = replace_once(
    text,
    "    const dialog = await screen.findByRole('dialog', { name: 'Diagnostyka · Salon' });\n    expect(await within(dialog).findByText('JS użyte teraz')).toBeVisible();",
    "    const dialog = await screen.findByRole('dialog', { name: 'Diagnostyka · Salon' });\n    expect(dialog).toHaveClass('lcl-modal--workspace');\n    expect(within(dialog).queryByRole('button', { name: 'Odśwież' })).toBeNull();\n    expect(await within(dialog).findByText('JS użyte teraz')).toBeVisible();",
    'assert canonical diagnostics workspace'
)
text = replace_once(
    text,
    "    const before = rpcMethods.filter((method) => method === 'Script.GetStatus').length;\n    fireEvent.click(within(dialog).getByRole('button', { name: 'Odśwież' }));\n    await waitFor(() =>\n      expect(\n        rpcMethods.filter((method) => method === 'Script.GetStatus').length\n      ).toBeGreaterThan(before)\n    );",
    "    const before = rpcMethods.filter((method) => method === 'Script.GetStatus').length;\n    await waitFor(\n      () =>\n        expect(\n          rpcMethods.filter((method) => method === 'Script.GetStatus').length\n        ).toBeGreaterThan(before),\n      { timeout: INSTALLATION_DIAGNOSTICS_REFRESH_MS + 2000 }\n    );",
    'test automatic diagnostics refresh'
)
text = replace_once(
    text,
    "  it('opens scoped technical diagnostics without duplicating the installation summary', async () => {",
    "  it('opens auto-refreshing scoped technical diagnostics in the shared workspace', async () => {",
    'rename diagnostics test'
)
write(rel, text)

# Final source guards for this architectural batch.
all_mobile = '\n'.join(p.read_text() for p in path('apps/mobile/src').rglob('*') if p.suffix in {'.ts', '.tsx'})
for forbidden in ['DiagnosticsSetupPage', 'DiagnosticsSetupFlow', 'diagnosticShellyId', 'setDiagnosticShellyId', 'openDeveloperDiagnostics']:
    if forbidden in all_mobile:
        raise SystemExit(f'legacy setup diagnostics reference remains: {forbidden}')
rule_page = read('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
for forbidden in ['deleteAutomationScript', 'deleteAutomationScriptMutation', 'Usuń z Shelly']:
    if forbidden in rule_page:
        raise SystemExit(f'legacy setup delete reference remains in RuleSetupPage: {forbidden}')

print('Scoped developer tools to setup script inspection/recovery and removed legacy setup diagnostics')
