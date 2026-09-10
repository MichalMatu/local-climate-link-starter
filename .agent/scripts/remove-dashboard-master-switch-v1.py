from pathlib import Path

ROOT = Path('.')


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrences, found {actual}')
    p.write_text(text.replace(old, new))


replace_exact(
    'apps/mobile/src/screens/AutomationDashboardScreen.tsx',
    '''        <div className="automation-card__header-actions">\n          <button\n            className="automation-master-switch"\n            type="button"\n            role="switch"\n            aria-checked={automationRunning}\n            aria-label={automationRunning ? t('detail.pause') : t('detail.resume')}\n            title={automationRunning ? t('detail.pause') : t('detail.resume')}\n            disabled={action.isPending || !controlsVerified}\n            onClick={() => action.mutate(automationRunning ? 'manual' : 'auto')}\n          >\n            <span className="automation-master-switch__thumb" />\n          </button>\n          <button\n''',
    '''        <div className="automation-card__header-actions">\n          <button\n'''
)

replace_exact(
    'apps/mobile/src/screens/AutomationDashboardScreen.css',
    '''  --dashboard-switch-height: calc(var(--lcl-spacing-lg) + var(--lcl-spacing-sm));\n  --dashboard-switch-width: calc(var(--lcl-spacing-2xl) + var(--lcl-spacing-lg));\n  --dashboard-switch-thumb: calc(\n    var(--dashboard-switch-height) - (var(--lcl-border-width-md) * 2)\n  );\n''',
    ''
)

replace_exact(
    'apps/mobile/src/screens/AutomationDashboardScreen.css',
    '''.automation-master-switch {\n  background: var(--lcl-color-surface-muted);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-round);\n  cursor: pointer;\n  height: var(--dashboard-switch-height);\n  padding: 0;\n  position: relative;\n  transition-duration: var(--lcl-motion-fast);\n  transition-property: background-color, border-color, opacity;\n  width: var(--dashboard-switch-width);\n}\n\n.automation-master-switch[aria-checked='true'] {\n  background: var(--lcl-color-accent);\n  border-color: var(--lcl-color-accent);\n}\n\n.automation-master-switch:disabled {\n  cursor: not-allowed;\n  opacity: var(--lcl-opacity-disabled);\n}\n\n.automation-master-switch__thumb {\n  background: var(--lcl-color-surface);\n  border-radius: var(--lcl-radius-round);\n  box-shadow: var(--lcl-shadow-sm);\n  height: var(--dashboard-switch-thumb);\n  left: var(--lcl-border-width-md);\n  position: absolute;\n  top: var(--lcl-border-width-md);\n  transition-duration: var(--lcl-motion-fast);\n  transition-property: transform;\n  width: var(--dashboard-switch-thumb);\n}\n\n.automation-master-switch[aria-checked='true'] .automation-master-switch__thumb {\n  transform: translateX(\n    calc(\n      var(--dashboard-switch-width) - var(--dashboard-switch-thumb) -\n        (var(--lcl-border-width-md) * 2)\n    )\n  );\n}\n\n''',
    ''
)

replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx',
    '''    const master = screen.getByRole('switch', { name: 'Wznów automatykę' });\n    const manual = screen.getByRole('button', { name: 'MANUAL' });\n''',
    '''    expect(screen.queryByRole('switch')).toBeNull();\n    const manual = screen.getByRole('button', { name: 'MANUAL' });\n'''
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx',
    '''    expect(master).toHaveAttribute('aria-checked', 'false');\n    expect(manual).toHaveAttribute('aria-pressed', 'true');\n''',
    '''    expect(manual).toHaveAttribute('aria-pressed', 'true');\n'''
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx',
    '''    fireEvent.click(master);\n    expect(runtimeMocks.mutate).toHaveBeenCalledWith('auto');\n\n    fireEvent.click(auto);\n''',
    '''    fireEvent.click(auto);\n'''
)

print('dashboard master switch removed')
