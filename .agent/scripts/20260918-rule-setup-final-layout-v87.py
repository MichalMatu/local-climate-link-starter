from pathlib import Path

root = Path('.')
page_path = root / 'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx'
css_path = root / 'apps/mobile/src/theme/theme.css'
test_path = root / 'apps/mobile/src/__tests__/hardware-setup.test.tsx'

page = page_path.read_text()

threshold_old = '      <div className="field-row">\n        <label className={flow.isThresholdValid ? \'field\' : \'field field--invalid\'}>'
threshold_new = '      <div className="field-row rule-threshold-row">\n        <label className={flow.isThresholdValid ? \'field\' : \'field field--invalid\'}>'
if threshold_old not in page:
    raise SystemExit('threshold field-row anchor not found')
page = page.replace(threshold_old, threshold_new, 1)

old_tail = '''      <div className="action-row rule-action-row">
        <button
          className="primary-action"
          type="button"
          aria-busy={flow.installMutation.isPending}
          disabled={
            !canInstallScript(flow) ||
            flow.installMutation.isPending ||
            flow.safeRelayTestMutation.isPending
          }
          title={t('hardware.rule.sendTitle')}
          onClick={() => flow.installMutation.mutate()}
        >
          {flow.installMutation.isPending ? t('common.sending') : t('common.send')}
        </button>
      </div>

      <div className="rule-progressive-disclosure-stack">
        <details className="rule-progressive-disclosure">
          <summary>{t('hardware.rule.advanced')}</summary>
          <RuleAdvancedSettingsInline flow={flow} />
        </details>

        <details className="rule-progressive-disclosure rule-progressive-disclosure--developer">
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
        </details>
      </div>
'''

new_tail = '''      <div className="action-row rule-developer-actions rule-developer-actions--compact">
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

      <details className="rule-progressive-disclosure">
        <summary>{t('hardware.rule.advanced')}</summary>
        <RuleAdvancedSettingsInline flow={flow} />
      </details>

      <div className="action-row rule-action-row">
        <button
          className="primary-action"
          type="button"
          aria-busy={flow.installMutation.isPending}
          disabled={
            !canInstallScript(flow) ||
            flow.installMutation.isPending ||
            flow.safeRelayTestMutation.isPending
          }
          title={t('hardware.rule.sendTitle')}
          onClick={() => flow.installMutation.mutate()}
        >
          {flow.installMutation.isPending ? t('common.sending') : t('common.send')}
        </button>
      </div>
'''

if old_tail not in page:
    raise SystemExit('rule action/disclosure tail anchor not found')
page = page.replace(old_tail, new_tail, 1)
page_path.write_text(page)

css = css_path.read_text()
css_anchor = '''.rule-action-row .primary-action {
  flex: 1 1 100%;
  width: 100%;
}
'''
css_replacement = '''.rule-threshold-row {
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rule-threshold-row .field {
  min-width: 0;
}

.rule-action-row .primary-action {
  flex: 1 1 100%;
  width: 100%;
}
'''
if css_anchor not in css:
    raise SystemExit('rule action CSS anchor not found')
css = css.replace(css_anchor, css_replacement, 1)

old_dev_grid = '''.rule-developer-actions--compact {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, var(--lcl-size-action-min-width)), 1fr)
  );
  width: 100%;
}
'''
new_dev_grid = '''.rule-developer-actions--compact {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}
'''
if old_dev_grid not in css:
    raise SystemExit('developer action grid CSS anchor not found')
css = css.replace(old_dev_grid, new_dev_grid, 1)
css_path.write_text(css)

test = test_path.read_text()
old_helper = "const openRuleDeveloperTools = () => openRuleDisclosure('Narzędzia deweloperskie');"
new_helper = '''const openRuleDeveloperTools = () => {
  const actions = document.querySelector('.rule-developer-actions--compact');
  expect(actions).not.toBeNull();
  expect(actions!.querySelectorAll('button')).toHaveLength(2);
};'''
if old_helper not in test:
    raise SystemExit('openRuleDeveloperTools helper anchor not found')
test = test.replace(old_helper, new_helper, 1)

insert_anchor = "  it('shows compact live values on the right side of the rule thermometer options', async () => {"
layout_test = '''  it('keeps the rule setup compact and ends with the primary send action', () => {
    renderHardwareSetup();
    fireEvent.click(screen.getByRole('button', { name: 'Reguła' }));

    const thresholdRow = document.querySelector('.rule-threshold-row');
    expect(thresholdRow).not.toBeNull();
    expect(thresholdRow!.querySelectorAll('input[type="number"]')).toHaveLength(2);

    const developerActions = document.querySelector('.rule-developer-actions--compact');
    expect(developerActions).not.toBeNull();
    expect(developerActions!.querySelectorAll('button')).toHaveLength(2);
    expect(
      screen.queryByText('Narzędzia deweloperskie', { selector: 'summary' })
    ).not.toBeInTheDocument();

    const advanced = screen.getByText('Zaawansowane', { selector: 'summary' });
    const send = screen.getByRole('button', { name: 'Wyślij' });
    const follows = (first: Node, second: Node) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(developerActions!, advanced)).toBe(true);
    expect(follows(advanced, send)).toBe(true);
  });

'''
if insert_anchor not in test:
    raise SystemExit('test insertion anchor not found')
test = test.replace(insert_anchor, layout_test + insert_anchor, 1)
test_path.write_text(test)

print('Applied compact threshold row and final rule setup action ordering')
