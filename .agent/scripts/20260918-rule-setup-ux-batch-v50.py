from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing block: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"non-unique block: {label} ({text.count(old)})")
    return text.replace(old, new, 1)

rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
text = replace_once(
    text,
    "import { RuleAdvancedSettingsModal } from './RuleAdvancedSettingsModal.js';\n",
    '',
    'advanced modal import',
)
text = replace_once(
    text,
    "  const [advancedDraft, setAdvancedDraft] = useState<RuleAdvancedSettingsInput>(() =>\n    createAdvancedDraft(flow)\n  );\n",
    '',
    'advanced draft state',
)
text = replace_once(
    text,
    "  const thresholdErrorId = useId();\n  const vpdErrorId = useId();\n",
    "  const thresholdErrorId = useId();\n  const vpdErrorId = useId();\n  const ruleModeSelectId = useId();\n  const vpdTargetInputId = useId();\n",
    'field ids',
)
text = replace_once(
    text,
    "  const advancedDraftValidation = validateRuleAdvancedSettings(advancedDraft);\n",
    "  const advancedSettings = createAdvancedDraft(flow);\n  const advancedSettingsValidation = validateRuleAdvancedSettings(advancedSettings);\n",
    'advanced validation',
)
old_functions = """  const openAdvancedModal = () => {
    setAdvancedDraft(createAdvancedDraft(flow));
    setDialog('advanced');
  };

  const resetAdvancedDraft = () => {
    setAdvancedDraft({
      ...DEFAULT_RULE_ADVANCED_SETTINGS,
      vpdAssistEnabled: flow.vpdAssistEnabled,
      vpdTargetInput: flow.vpdTargetInput
    });
  };

  const updateAdvancedDraft = (patch: Partial<RuleAdvancedSettingsInput>) => {
    setAdvancedDraft((current) => ({ ...current, ...patch }));
  };

  const applyAdvancedDraft = () => {
    if (!advancedDraftValidation.isValid) {
      return;
    }

    flow.setRssiMinInput(advancedDraft.rssiMinInput);
    flow.setStaleTimeoutMinInput(advancedDraft.staleTimeoutMinInput);
    flow.setMinChangeMinInput(advancedDraft.minChangeMinInput);
    flow.setMaxOnHoursInput(advancedDraft.maxOnHoursInput);
    setDialog('none');
  };

"""
new_functions = """  const resetAdvancedSettings = () => {
    flow.setRssiMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.rssiMinInput);
    flow.setStaleTimeoutMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.staleTimeoutMinInput);
    flow.setMinChangeMinInput(DEFAULT_RULE_ADVANCED_SETTINGS.minChangeMinInput);
    flow.setMaxOnHoursInput(DEFAULT_RULE_ADVANCED_SETTINGS.maxOnHoursInput);
  };

"""
text = replace_once(text, old_functions, new_functions, 'advanced modal handlers')
old_rule_mode = """      <label className=\"field\">
        {t('hardware.rule.ruleMode')}
        <span className=\"select-control\">
          <select
            value={flow.rulePreset}
            onChange={(event) =>
              flow.setRulePreset(event.currentTarget.value as RulePresetId)
            }
          >
            {selectablePresets.map((preset) => (
              <option key={preset} value={preset}>
                {t(RULE_PRESET_COPY[preset].labelKey)}
              </option>
            ))}
          </select>
        </span>
      </label>
"""
new_rule_mode = """      <div className=\"field\">
        <div className=\"rule-field-label-row\">
          <label htmlFor={ruleModeSelectId}>{t('hardware.rule.ruleMode')}</label>
          <button
            aria-label={t('hardware.rule.summaryTitle')}
            className=\"icon-action rule-summary-icon-action\"
            type=\"button\"
            title={t('hardware.rule.summaryTitle')}
            onClick={() => setDialog('summary')}
          >
            <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />
          </button>
        </div>
        <span className=\"select-control\">
          <select
            id={ruleModeSelectId}
            value={flow.rulePreset}
            onChange={(event) =>
              flow.setRulePreset(event.currentTarget.value as RulePresetId)
            }
          >
            {selectablePresets.map((preset) => (
              <option key={preset} value={preset}>
                {t(RULE_PRESET_COPY[preset].labelKey)}
              </option>
            ))}
          </select>
        </span>
      </div>
"""
text = replace_once(text, old_rule_mode, new_rule_mode, 'rule mode field')
old_vpd = """      <section className=\"rule-vpd-assist\">
        <div className=\"rule-vpd-assist__header\">
          <div className=\"icon-action-row\">
            <strong>{t('hardware.rule.vpdAssistTitle')}</strong>
            <button
              aria-label={t('hardware.rule.vpdAssistHint')}
              className=\"icon-action rule-summary-icon-action\"
              type=\"button\"
              title={t('hardware.rule.vpdAssistHint')}
              onClick={() => setDialog('vpd-info')}
            >
              <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />
            </button>
          </div>
          <label className=\"toggle-row rule-vpd-assist__toggle\">
            <input
              aria-label={t('hardware.rule.vpdAssistTitle')}
              type=\"checkbox\"
              checked={flow.vpdAssistEnabled}
              onChange={(event) => flow.setVpdAssistEnabled(event.currentTarget.checked)}
            />
            <span>
              {flow.vpdAssistEnabled ? t('common.enabled') : t('common.disabled')}
            </span>
          </label>
        </div>
        {flow.vpdAssistEnabled && (
          <label className={`field ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}>
            {t('hardware.rule.vpdTarget')}
            <input
              aria-describedby={flow.isVpdAssistValid ? undefined : vpdErrorId}
              aria-invalid={!flow.isVpdAssistValid}
              max={RULE_ADVANCED_LIMITS.vpdTargetMax}
              min={RULE_ADVANCED_LIMITS.vpdTargetMin}
              step=\"0.05\"
              type=\"number\"
              value={flow.vpdTargetInput}
              onChange={(event) => flow.setVpdTargetInput(event.currentTarget.value)}
            />
            {!flow.isVpdAssistValid && (
              <span className=\"field__error\" id={vpdErrorId}>
                {t('hardware.rule.range.kpa')}
              </span>
            )}
          </label>
        )}
      </section>
"""
new_vpd = """      <section className=\"rule-vpd-assist\">
        <div className=\"rule-vpd-assist__header\">
          <div className=\"icon-action-row\">
            <strong>{t('hardware.rule.vpdAssistTitle')}</strong>
            <button
              aria-label={t('hardware.rule.vpdAssistHint')}
              className=\"icon-action rule-summary-icon-action\"
              type=\"button\"
              title={t('hardware.rule.vpdAssistHint')}
              onClick={() => setDialog('vpd-info')}
            >
              <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />
            </button>
          </div>
          <label className=\"toggle-row rule-vpd-assist__toggle\">
            <input
              aria-label={t('hardware.rule.vpdAssistTitle')}
              type=\"checkbox\"
              checked={flow.vpdAssistEnabled}
              onChange={(event) => flow.setVpdAssistEnabled(event.currentTarget.checked)}
            />
            <span className=\"rule-vpd-assist__toggle-state\">
              {flow.vpdAssistEnabled ? t('common.enabled') : t('common.disabled')}
            </span>
          </label>
        </div>
        {flow.vpdAssistEnabled && (
          <div
            className={`rule-vpd-target-row ${flow.isVpdAssistValid ? '' : 'field--invalid'}`}
          >
            <label className=\"rule-vpd-target-row__label\" htmlFor={vpdTargetInputId}>
              {t('hardware.rule.vpdTargetShort')}
            </label>
            <span className=\"rule-vpd-target-control\">
              <input
                id={vpdTargetInputId}
                aria-label={t('hardware.rule.vpdTarget')}
                aria-describedby={flow.isVpdAssistValid ? undefined : vpdErrorId}
                aria-invalid={!flow.isVpdAssistValid}
                max={RULE_ADVANCED_LIMITS.vpdTargetMax}
                min={RULE_ADVANCED_LIMITS.vpdTargetMin}
                step=\"0.05\"
                type=\"number\"
                value={flow.vpdTargetInput}
                onChange={(event) => flow.setVpdTargetInput(event.currentTarget.value)}
              />
              <span className=\"rule-vpd-target-control__unit\" aria-hidden=\"true\">
                kPa
              </span>
            </span>
            {!flow.isVpdAssistValid && (
              <span className=\"field__error rule-vpd-target-row__error\" id={vpdErrorId}>
                {t('hardware.rule.range.kpa')}
              </span>
            )}
          </div>
        )}
      </section>
"""
text = replace_once(text, old_vpd, new_vpd, 'VPD section')
old_action_intro = """      <div className=\"action-row rule-action-row\">
        <button
          aria-label={t('hardware.rule.summaryTitle')}
          className=\"icon-action rule-summary-icon-action\"
          type=\"button\"
          title={t('hardware.rule.summaryTitle')}
          onClick={() => setDialog('summary')}
        >
          <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />
        </button>
        <button
"""
text = replace_once(
    text,
    old_action_intro,
    """      <div className=\"action-row rule-action-row\">\n        <button\n""",
    'summary icon above send',
)
old_advanced_details = """        <details className=\"rule-progressive-disclosure\">
          <summary>{t('hardware.rule.advanced')}</summary>
          <div className=\"rule-progressive-disclosure__body\">
            <p>{t('hardware.rule.advancedDisclosureHint')}</p>
            <button
              className=\"secondary-action\"
              type=\"button\"
              title={t('hardware.rule.advancedTitleAttr')}
              onClick={openAdvancedModal}
            >
              {t('hardware.rule.openAdvanced')}
            </button>
          </div>
        </details>
"""
new_advanced_details = """        <details className=\"rule-progressive-disclosure\">
          <summary>{t('hardware.rule.advanced')}</summary>
          <div className=\"rule-progressive-disclosure__body rule-advanced-inline\">
            <p>{t('hardware.rule.advancedDisclosureHint')}</p>
            <div className=\"rule-advanced-inline__grid\">
              <label
                className={`rule-advanced-inline__field ${
                  advancedSettingsValidation.isMinChangeMinValid ? '' : 'field--invalid'
                }`}
              >
                <span>{t('hardware.rule.minChangeLabel')}</span>
                <input
                  aria-describedby={
                    advancedSettingsValidation.isMinChangeMinValid
                      ? undefined
                      : 'advanced-min-change-error'
                  }
                  aria-invalid={!advancedSettingsValidation.isMinChangeMinValid}
                  max={RULE_ADVANCED_LIMITS.minChangeMinMax}
                  min={RULE_ADVANCED_LIMITS.minChangeMinMin}
                  step=\"0.25\"
                  type=\"number\"
                  value={flow.minChangeMinInput}
                  onChange={(event) => flow.setMinChangeMinInput(event.currentTarget.value)}
                />
                {!advancedSettingsValidation.isMinChangeMinValid && (
                  <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-min-change-error\">
                    {t('hardware.rule.range.minChange')}
                  </span>
                )}
              </label>
              <label
                className={`rule-advanced-inline__field ${
                  advancedSettingsValidation.isMaxOnHoursValid ? '' : 'field--invalid'
                }`}
              >
                <span>{t('hardware.rule.maxOnHoursLabel')}</span>
                <input
                  aria-describedby={
                    advancedSettingsValidation.isMaxOnHoursValid
                      ? undefined
                      : 'advanced-max-on-error'
                  }
                  aria-invalid={!advancedSettingsValidation.isMaxOnHoursValid}
                  max={RULE_ADVANCED_LIMITS.maxOnHoursMax}
                  min={RULE_ADVANCED_LIMITS.maxOnHoursMin}
                  step=\"0.25\"
                  type=\"number\"
                  value={flow.maxOnHoursInput}
                  onChange={(event) => flow.setMaxOnHoursInput(event.currentTarget.value)}
                />
                {!advancedSettingsValidation.isMaxOnHoursValid && (
                  <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-max-on-error\">
                    {t('hardware.rule.range.maxOn')}
                  </span>
                )}
              </label>
            </div>
            <div className=\"advanced-settings__readonly rule-advanced-inline__readonly\">
              <span>{t('hardware.rule.bootBehavior')}</span>
              <strong>{t('hardware.rule.bootBehaviorValue')}</strong>
            </div>
            <div className=\"rule-advanced-inline__grid rule-advanced-inline__grid--resilience\">
              <label
                className={`rule-advanced-inline__field ${
                  advancedSettingsValidation.isStaleTimeoutValid ? '' : 'field--invalid'
                }`}
              >
                <span>{t('hardware.rule.staleTimeoutLabel')}</span>
                <input
                  aria-describedby={
                    advancedSettingsValidation.isStaleTimeoutValid
                      ? undefined
                      : 'advanced-stale-error'
                  }
                  aria-invalid={!advancedSettingsValidation.isStaleTimeoutValid}
                  max={RULE_ADVANCED_LIMITS.staleTimeoutMinMax}
                  min={RULE_ADVANCED_LIMITS.staleTimeoutMinMin}
                  step=\"1\"
                  type=\"number\"
                  value={flow.staleTimeoutMinInput}
                  onChange={(event) =>
                    flow.setStaleTimeoutMinInput(event.currentTarget.value)
                  }
                />
                {!advancedSettingsValidation.isStaleTimeoutValid && (
                  <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-stale-error\">
                    {t('hardware.rule.range.stale')}
                  </span>
                )}
              </label>
              <label
                className={`rule-advanced-inline__field ${
                  advancedSettingsValidation.isRssiMinValid ? '' : 'field--invalid'
                }`}
              >
                <span>{t('hardware.rule.rssiMinLabel')}</span>
                <input
                  aria-describedby={
                    advancedSettingsValidation.isRssiMinValid
                      ? undefined
                      : 'advanced-rssi-error'
                  }
                  aria-invalid={!advancedSettingsValidation.isRssiMinValid}
                  max={RULE_ADVANCED_LIMITS.rssiMinMax}
                  min={RULE_ADVANCED_LIMITS.rssiMinMin}
                  step=\"1\"
                  type=\"number\"
                  value={flow.rssiMinInput}
                  onChange={(event) => flow.setRssiMinInput(event.currentTarget.value)}
                />
                {!advancedSettingsValidation.isRssiMinValid && (
                  <span className=\"field__error rule-advanced-inline__error\" id=\"advanced-rssi-error\">
                    {t('hardware.rule.range.rssi')}
                  </span>
                )}
              </label>
            </div>
            <button
              className=\"rule-advanced-defaults-link\"
              type=\"button\"
              title={t('hardware.rule.advancedDefaultsTitle')}
              onClick={resetAdvancedSettings}
            >
              {t('common.default')}
            </button>
          </div>
        </details>
"""
text = replace_once(text, old_advanced_details, new_advanced_details, 'advanced disclosure')
old_modal = """      <RuleAdvancedSettingsModal
        draft={advancedDraft}
        open={dialog === 'advanced'}
        onApply={applyAdvancedDraft}
        onChange={updateAdvancedDraft}
        onClose={() => setDialog('none')}
        onReset={resetAdvancedDraft}
      />
"""
text = replace_once(text, old_modal, '', 'advanced modal render')
rule_path.write_text(text)

feedback_path = Path('apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts')
feedback = feedback_path.read_text()
feedback = replace_once(feedback, "  | 'advanced'\n", '', 'advanced dialog union')
feedback_path.write_text(feedback)

# Add concise VPD label while keeping the existing accessible label that includes units.
short_labels = {
    'en.ts': 'Target VPD',
    'pl.ts': 'Docelowe VPD',
    'de.ts': 'Ziel-VPD',
    'es.ts': 'VPD objetivo',
    'fr.ts': 'VPD cible',
    'it.ts': 'VPD target',
    'ptBr.ts': 'VPD alvo',
}
for filename, label in short_labels.items():
    path = Path('apps/mobile/src/app/locales') / filename
    locale = path.read_text()
    if 'vpdTargetShort:' in locale:
        continue
    pattern = re.compile(r"(\n\s+vpdTarget:\s*'[^']*',)")
    match = pattern.search(locale)
    if not match:
        raise SystemExit(f'missing vpdTarget in {filename}')
    locale = locale[:match.end()] + f"\n      vpdTargetShort: '{label}'," + locale[match.end():]
    path.write_text(locale)

# Layout overrides are intentionally kept with the shared theme and use existing tokens.
theme_path = Path('apps/mobile/src/theme/theme.css')
theme = theme_path.read_text()
marker = '/* Rule setup compact UX batch */'
if marker not in theme:
    theme += """

/* Rule setup compact UX batch */
.rule-field-label-row {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
}

.rule-field-label-row > label {
  color: var(--lcl-color-text);
  font-weight: var(--lcl-font-weight-semibold);
}

.rule-vpd-assist {
  background: transparent;
  border: 0;
  border-radius: 0;
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  padding: var(--lcl-spacing-lg) 0 0;
}

.rule-vpd-assist__header {
  align-items: center;
}

.rule-vpd-assist__toggle {
  margin-left: auto;
}

.rule-vpd-assist__toggle-state {
  position: absolute;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
  width: 1px;
}

.rule-vpd-target-row {
  align-items: center;
  display: grid;
  gap: var(--lcl-spacing-sm) var(--lcl-spacing-md);
  grid-template-columns: minmax(0, 1fr) minmax(var(--lcl-size-control-min-height), 1.4fr);
}

.rule-vpd-target-row__label {
  color: var(--lcl-color-text);
  font-weight: var(--lcl-font-weight-semibold);
}

.rule-vpd-target-control {
  display: block;
  min-width: 0;
  position: relative;
}

.rule-vpd-target-control input {
  padding-right: calc(var(--lcl-spacing-xl) + var(--lcl-spacing-lg));
  width: 100%;
}

.rule-vpd-target-control__unit {
  color: var(--lcl-color-text-muted);
  pointer-events: none;
  position: absolute;
  right: var(--lcl-spacing-md);
  top: 50%;
  transform: translateY(-50%);
}

.rule-vpd-target-row__error {
  grid-column: 1 / -1;
}

.rule-action-row .primary-action {
  flex: 1 1 100%;
  width: 100%;
}

.rule-advanced-inline {
  gap: var(--lcl-spacing-md);
}

.rule-advanced-inline__grid {
  display: grid;
  gap: var(--lcl-spacing-sm);
}

.rule-advanced-inline__grid--resilience {
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  padding-top: var(--lcl-spacing-md);
}

.rule-advanced-inline__field {
  align-items: center;
  display: grid;
  gap: var(--lcl-spacing-sm) var(--lcl-spacing-md);
  grid-template-columns: minmax(0, 1fr) minmax(var(--lcl-size-control-min-height), 0.85fr);
}

.rule-advanced-inline__field > span:first-child {
  color: var(--lcl-color-text);
  font-weight: var(--lcl-font-weight-semibold);
}

.rule-advanced-inline__field input {
  min-width: 0;
  width: 100%;
}

.rule-advanced-inline__error {
  grid-column: 1 / -1;
}

.rule-advanced-inline__readonly {
  margin: 0;
}

.rule-advanced-defaults-link {
  align-self: start;
  background: transparent;
  border: 0;
  color: var(--lcl-color-accent);
  cursor: pointer;
  font: inherit;
  font-weight: var(--lcl-font-weight-semibold);
  justify-self: start;
  padding: 0;
}

.rule-advanced-defaults-link:hover,
.rule-advanced-defaults-link:focus-visible {
  text-decoration: underline;
}
"""
    theme_path.write_text(theme)

# Update the focused rule test from nested modal semantics to inline advanced settings.
test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
test = test_path.read_text()
test, removed = re.subn(
    r"\nconst openRuleAdvancedDialog = async \(\) => \{\n  openRuleDisclosure\('Zaawansowane'\);\n  fireEvent\.click\(screen\.getByRole\('button', \{ name: 'Otwórz opcje zaawansowane' \}\)\);\n  return screen\.findByRole\('dialog', \{ name: 'Opcje zaawansowane' \}\);\n\};\n",
    '\n',
    test,
    count=1,
)
if removed != 1:
    raise SystemExit(f'failed to remove advanced dialog helper: {removed}')
start = test.index("      let advancedDialog = await openRuleAdvancedDialog();")
end = test.index("      scriptDialog = await openRuleScriptDialog();", start)
new_first = """      const advancedSection = openRuleDisclosure('Zaawansowane');
      expect(
        screen.queryByRole('dialog', { name: 'Opcje zaawansowane' })
      ).not.toBeInTheDocument();
      expect(
        within(advancedSection).queryByRole('button', { name: 'Otwórz opcje zaawansowane' })
      ).not.toBeInTheDocument();
      expect(
        within(advancedSection).getByRole('button', { name: 'Domyślne' })
      ).toHaveClass('rule-advanced-defaults-link');
      expect(
        within(advancedSection).getByText('OFF, potem AUTO po pierwszym odczycie')
      ).toBeInTheDocument();
      fireEvent.change(within(advancedSection).getByLabelText('Minimalny RSSI dBm'), {
        target: { value: '-80' }
      });
      fireEvent.change(within(advancedSection).getByLabelText('Brak odczytu przez min'), {
        target: { value: '10' }
      });
      fireEvent.change(within(advancedSection).getByLabelText(/Ponowne ON po min/), {
        target: { value: '3' }
      });
      fireEvent.change(within(advancedSection).getByLabelText('Maksymalny czas pracy h'), {
        target: { value: '3' }
      });
      expect(getRuleSummary()).toHaveTextContent(
        'Gdy termometr Xiaomi salon zniknie na 10 min albo Shelly Salon uruchomi się ponownie'
      );
      expect(getRuleSummary()).toHaveTextContent('Maksymalny czas pracy: 3 h');
      expect(getRuleSummary()).toHaveTextContent('Ponowne ON najwcześniej po 3 min');
      expect(getRuleSummary()).toHaveTextContent('VPD assist uwzględni cel 1.25 kPa');
      expect(getRuleSummary()).toHaveTextContent(
        'Sygnał termometru musi mieć co najmniej -80 dBm'
      );
      expect(getRuleSummary()).not.toHaveTextContent('VPD:');
      expect(getRuleSummary()).not.toHaveTextContent('RSSI:');
"""
test = test[:start] + new_first + test[end:]
start = test.index("      advancedDialog = await openRuleAdvancedDialog();")
end = test.index("      scriptDialog = await openRuleScriptDialog();", start)
new_second = """      fireEvent.change(within(advancedSection).getByLabelText(/Ponowne ON po min/), {
        target: { value: '0' }
      });
      expect(screen.getByRole('button', { name: 'Wyślij' })).toBeDisabled();
      expect(
        within(advancedSection).getByText('Zakres: 0.25 do 60 min.')
      ).toBeInTheDocument();
      fireEvent.change(within(advancedSection).getByLabelText(/Ponowne ON po min/), {
        target: { value: '3' }
      });
      expect(screen.getByRole('button', { name: 'Wyślij' })).toBeEnabled();

"""
test = test[:start] + new_second + test[end:]
# The info affordance now belongs to the Rule mode row, while VPD keeps its local info affordance.
needle = """      fireEvent.change(screen.getByLabelText('Tryb reguły'), {
        target: { value: 'humidifying' }
      });

"""
insert = needle + """      const ruleModeField = screen.getByLabelText('Tryb reguły').closest('.field');
      expect(ruleModeField).not.toBeNull();
      expect(
        within(ruleModeField as HTMLElement).getByRole('button', { name: 'Podsumowanie reguły' })
      ).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /VPD assist/ }).length).toBeGreaterThanOrEqual(1);

"""
test = replace_once(test, needle, insert, 'rule mode info assertion')
test_path.write_text(test)

# Persist the fast batch workflow in the repository operating contract.
agents_path = Path('AGENTS.md')
agents = agents_path.read_text()
workflow_marker = '## 16A. Fast UX iteration mode'
if workflow_marker not in agents:
    insertion = """
## 16A. Fast UX iteration mode

For a sequence of user-approved, low-risk presentation/interaction refinements on the same screen, work in batches instead of treating every micro-change as a release candidate.

During a batch:

- combine several approved visual/UX changes into one coherent patch;
- run Prettier/ESLint only on changed files, mobile typecheck, and the narrowest focused tests that exercise the changed behavior;
- do not run the full repository check, Android rebuild, clean uninstall, or device smoke after every icon/spacing/copy adjustment;
- keep behavior-affecting assertions in focused tests even when the change is primarily visual.

Before presenting the batch for user review:

1. run one full `pnpm check`;
2. if it passes, commit once and push with `--no-verify` so the identical `prepush` full check is not run a second time;
3. build/install Android once and run the relevant device smoke once;
4. report exact focused/full-check/device evidence.

When a deterministic final-gate failure is found, fix it in the same Local Agent task when practical instead of creating a new wait/poll cycle. Retry tasks must be reconstructible from the remote branch plus a deterministic patch; never depend on an unpushed local-only commit.

This fast mode is for iterative UX work. Runtime safety, relay-control semantics, generated Shelly Script behavior, persistence/schema changes, and other safety-critical changes still require the strongest relevant focused tests and hardware validation. Never skip the final full check before declaring a coding batch done.

---

"""
    anchor = '## 17. Documentation policy\n'
    if anchor not in agents:
        raise SystemExit('missing AGENTS section 17 anchor')
    agents = agents.replace(anchor, insertion + anchor, 1)
    agents_path.write_text(agents)

print('Applied compact rule setup UX batch and fast UX workflow contract')
