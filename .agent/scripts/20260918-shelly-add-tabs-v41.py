from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


page = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = page.read_text()

s = replace_once(
    s,
    """  const [activeAddSection, setActiveAddSection] = useState<'manual' | 'scan' | null>(\n    'manual'\n  );\n""",
    """  const [activeAddSection, setActiveAddSection] = useState<'manual' | 'scan'>('scan');\n""",
    'active add section state'
)

s = replace_once(
    s,
    """  const openAddShellyModal = () => {\n    flow.checkShellyMutation.reset();\n    setDidSubmitShellyAdd(false);\n    setActiveAddSection('manual');\n    setDialog({ kind: 'add' });\n  };\n""",
    """  const openAddShellyModal = () => {\n    flow.checkShellyMutation.reset();\n    setDidSubmitShellyAdd(false);\n    setActiveAddSection('scan');\n    setDialog({ kind: 'add' });\n  };\n""",
    'open add modal default tab'
)

s = replace_once(
    s,
    """    setScanResultNames({});\n    setActiveAddSection('manual');\n    setDialog({ kind: 'none' });\n""",
    """    setScanResultNames({});\n    setActiveAddSection('scan');\n    setDialog({ kind: 'none' });\n""",
    'close add modal default tab'
)

s = replace_once(
    s,
    """  const toggleAddSection = (section: 'manual' | 'scan') => {\n    const nextSection = activeAddSection === section ? null : section;\n    if (activeAddSection === 'scan' && nextSection !== 'scan' && isShellyScanActive) {\n      flow.stopShellyScan();\n    }\n    setActiveAddSection(nextSection);\n  };\n""",
    """  const selectAddSection = (section: 'manual' | 'scan') => {\n    if (section === activeAddSection) {\n      return;\n    }\n    if (activeAddSection === 'scan' && isShellyScanActive) {\n      flow.stopShellyScan();\n    }\n    setActiveAddSection(section);\n  };\n""",
    'tab selection handler'
)

manual_old = """        <details className=\"shelly-manual-add\" open={activeAddSection === 'manual'}>\n          <summary\n            onClick={(event) => {\n              event.preventDefault();\n              toggleAddSection('manual');\n            }}\n          >\n            {t('hardware.shelly.addManual')}\n          </summary>\n          <div className=\"shelly-manual-add__body\">\n            <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />\n            <div className=\"shelly-manual-add__actions\">\n              <button\n                className=\"primary-action\"\n                type=\"button\"\n                aria-busy={flow.checkShellyMutation.isPending || undefined}\n                disabled={isAnyShellyCheckPending}\n                title={t('hardware.shelly.addCheckedTitle')}\n                onClick={checkShelly}\n              >\n                {flow.checkShellyMutation.isPending\n                  ? t('hardware.shelly.checking')\n                  : t('common.add')}\n              </button>\n            </div>\n          </div>\n        </details>\n        <details className=\"shelly-network-scan\" open={activeAddSection === 'scan'}>\n          <summary\n            onClick={(event) => {\n              event.preventDefault();\n              toggleAddSection('scan');\n            }}\n          >\n            {t('hardware.shelly.scanNetwork')}\n          </summary>\n          <div className=\"shelly-network-scan__body\">\n"""

manual_new = """        <div\n          className=\"shelly-add-tabs\"\n          role=\"tablist\"\n          aria-label={t('hardware.shelly.add')}\n        >\n          <button\n            className=\"shelly-add-tabs__tab\"\n            type=\"button\"\n            role=\"tab\"\n            aria-selected={activeAddSection === 'scan'}\n            onClick={() => selectAddSection('scan')}\n          >\n            {t('hardware.shelly.scanNetwork')}\n          </button>\n          <button\n            className=\"shelly-add-tabs__tab\"\n            type=\"button\"\n            role=\"tab\"\n            aria-selected={activeAddSection === 'manual'}\n            onClick={() => selectAddSection('manual')}\n          >\n            {t('hardware.shelly.addManual')}\n          </button>\n        </div>\n        {activeAddSection === 'manual' && (\n          <section\n            className=\"shelly-manual-add\"\n            role=\"tabpanel\"\n            aria-label={t('hardware.shelly.addManual')}\n          >\n            <div className=\"shelly-manual-add__body\">\n              <ShellyAddForm flow={flow} showValidationErrors={didSubmitShellyAdd} />\n              <div className=\"shelly-manual-add__actions\">\n                <button\n                  className=\"primary-action\"\n                  type=\"button\"\n                  aria-busy={flow.checkShellyMutation.isPending || undefined}\n                  disabled={isAnyShellyCheckPending}\n                  title={t('hardware.shelly.addCheckedTitle')}\n                  onClick={checkShelly}\n                >\n                  {flow.checkShellyMutation.isPending\n                    ? t('hardware.shelly.checking')\n                    : t('common.add')}\n                </button>\n              </div>\n            </div>\n          </section>\n        )}\n        {activeAddSection === 'scan' && (\n          <section\n            className=\"shelly-network-scan\"\n            role=\"tabpanel\"\n            aria-label={t('hardware.shelly.scanNetwork')}\n          >\n            <div className=\"shelly-network-scan__body\">\n"""

s = replace_once(s, manual_old, manual_new, 'manual/scan disclosures')

s = replace_once(
    s,
    """            <div className=\"field-row\">\n              <label\n""",
    """            <div className=\"shelly-network-scan__range\">\n              <label\n""",
    'scan range row'
)

s = replace_once(
    s,
    """            {isShellyScanActive && (\n              <div className=\"shelly-network-scan__progress\">\n                <span className=\"scan-loading-state__spinner\" aria-hidden=\"true\" />\n                <span>{t('hardware.shelly.scanningIpRange')}</span>\n              </div>\n            )}\n          </div>\n        </details>\n      </Modal>\n""",
    """            {isShellyScanActive && (\n              <div className=\"shelly-network-scan__progress\">\n                <span className=\"scan-loading-state__spinner\" aria-hidden=\"true\" />\n                <span>{t('hardware.shelly.scanningIpRange')}</span>\n              </div>\n            )}\n            </div>\n          </section>\n        )}\n      </Modal>\n""",
    'scan panel close'
)

page.write_text(s)

css = Path('apps/mobile/src/theme/theme.css')
c = css.read_text()

old_css = """.shelly-network-scan {\n  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  margin-top: var(--lcl-spacing-sm);\n}\n\n.shelly-manual-add > summary,\n.shelly-network-scan > summary {\n  color: var(--lcl-color-text);\n  cursor: pointer;\n  font-weight: var(--lcl-font-weight-bold);\n  list-style-position: inside;\n  min-height: var(--lcl-size-control-min-height);\n  padding: var(--lcl-spacing-md) 0;\n}\n\n"""
new_css = """.shelly-add-tabs {\n  background: var(--lcl-color-surface-muted);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-md);\n  display: flex;\n  gap: var(--lcl-spacing-xs);\n  padding: var(--lcl-spacing-xs);\n}\n\n.shelly-add-tabs__tab {\n  background: transparent;\n  border: 0;\n  border-radius: var(--lcl-radius-sm);\n  color: var(--lcl-color-text-muted);\n  cursor: pointer;\n  flex: 1 1 0;\n  font: inherit;\n  font-size: var(--lcl-font-size-md);\n  font-weight: var(--lcl-font-weight-semibold);\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding: 0 var(--lcl-spacing-md);\n}\n\n.shelly-add-tabs__tab[aria-selected='true'] {\n  background: var(--lcl-color-accent);\n  color: var(--lcl-color-accent-contrast);\n}\n\n.shelly-add-tabs__tab:focus-visible {\n  outline: var(--lcl-border-width-md) solid var(--lcl-color-accent);\n  outline-offset: var(--lcl-border-width-sm);\n}\n\n"""
c = replace_once(c, old_css, new_css, 'disclosure css')

range_anchor = """.shelly-network-scan__toolbar {\n  align-items: center;\n  display: flex;\n  gap: var(--lcl-spacing-sm);\n  justify-content: flex-end;\n}\n\n"""
range_css = range_anchor + """.shelly-network-scan__range {\n  display: flex;\n  gap: var(--lcl-spacing-md);\n}\n\n.shelly-network-scan__range > .field {\n  flex: 1 1 0;\n  min-width: 0;\n}\n\n.shelly-network-scan__range input {\n  box-sizing: border-box;\n  min-width: 0;\n  width: 100%;\n}\n\n"""
c = replace_once(c, range_anchor, range_css, 'range css')
css.write_text(c)

test = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
t = test.read_text()

helper_old = """const openShellyAddDialog = async () => {\n  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));\n  return screen.findByRole('dialog', { name: 'Dodaj gniazdko' });\n};\n"""
helper_new = """const openShellyAddDialog = async (section: 'manual' | 'scan' = 'manual') => {\n  fireEvent.click(screen.getByRole('button', { name: 'Dodaj gniazdko' }));\n  const dialog = await screen.findByRole('dialog', { name: 'Dodaj gniazdko' });\n  if (section === 'manual') {\n    fireEvent.click(within(dialog).getByRole('tab', { name: 'Dodaj ręcznie' }));\n  }\n  return dialog;\n};\n"""
t = replace_once(t, helper_old, helper_new, 'open dialog helper')

for test_name in [
    'adds a scanned Shelly directly with an editable per-result name',
    'shows already saved Shelly devices and continues scanning the full range',
    'shows Shelly scan help as a compact tooltip',
    'uses the discovered model as the default scanner name without populating the manual form'
]:
    start = t.index(f"  it('{test_name}'")
    end = t.find("\n  it('", start + 6)
    if end == -1:
        end = len(t)
    block = t[start:end]
    if 'openShellyAddDialog()' not in block:
        raise SystemExit(f'{test_name}: expected openShellyAddDialog()')
    block = block.replace('openShellyAddDialog()', "openShellyAddDialog('scan')", 1)
    t = t[:start] + block + t[end:]

old_tab_assertions = """    const manualSummary = within(dialog).getByText('Dodaj ręcznie');\n    const scanSummary = within(dialog).getByText('Skanuj sieć');\n    expect(manualSummary.closest('details')).toHaveAttribute('open');\n    expect(scanSummary.closest('details')).not.toHaveAttribute('open');\n    fireEvent.click(scanSummary);\n    expect(manualSummary.closest('details')).not.toHaveAttribute('open');\n    expect(scanSummary.closest('details')).toHaveAttribute('open');\n\n"""
new_tab_assertions = """    const scanTab = within(dialog).getByRole('tab', { name: 'Skanuj sieć' });\n    const manualTab = within(dialog).getByRole('tab', { name: 'Dodaj ręcznie' });\n    expect(scanTab).toHaveAttribute('aria-selected', 'true');\n    expect(manualTab).toHaveAttribute('aria-selected', 'false');\n    expect(within(dialog).getByRole('tabpanel', { name: 'Skanuj sieć' })).toBeInTheDocument();\n    expect(\n      within(dialog).queryByRole('tabpanel', { name: 'Dodaj ręcznie' })\n    ).not.toBeInTheDocument();\n\n    const rangeStart = within(dialog).getByLabelText('Od');\n    const rangeEnd = within(dialog).getByLabelText('Do');\n    const rangeRow = rangeStart.closest('.shelly-network-scan__range');\n    expect(rangeRow).not.toBeNull();\n    expect(rangeRow).toContainElement(rangeEnd);\n\n    fireEvent.click(manualTab);\n    expect(manualTab).toHaveAttribute('aria-selected', 'true');\n    expect(within(dialog).getByRole('tabpanel', { name: 'Dodaj ręcznie' })).toBeInTheDocument();\n    expect(\n      within(dialog).queryByRole('tabpanel', { name: 'Skanuj sieć' })\n    ).not.toBeInTheDocument();\n    fireEvent.click(scanTab);\n    expect(scanTab).toHaveAttribute('aria-selected', 'true');\n\n"""
t = replace_once(t, old_tab_assertions, new_tab_assertions, 'tab assertions')

test.write_text(t)
