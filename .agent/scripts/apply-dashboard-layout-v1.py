from pathlib import Path

p = Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
s = p.read_text()
old = '''        <div>\n          <p className="demo-kicker">Local Climate Link</p>\n          <h1>{t('dashboard.title')}</h1>\n          <p>{t('dashboard.description')}</p>\n        </div>'''
new = '''        <div>\n          <h1>{t('dashboard.title')}</h1>\n        </div>'''
assert old in s
p.write_text(s.replace(old, new, 1))

p = Path('apps/mobile/src/theme/theme.css')
s = p.read_text()
replacements = [
('''  gap: var(--lcl-spacing-lg);\n  min-width: 0;\n  padding: var(--lcl-fluid-panel-padding);''', '''  gap: var(--lcl-spacing-md);\n  min-width: 0;\n  padding: var(--lcl-spacing-lg);'''),
('''  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-action-min-width)), 1fr)\n  );''', '''  grid-template-columns: repeat(3, minmax(0, 1fr));'''),
('''  padding: var(--lcl-spacing-md);\n}\n\n.automation-metrics span,''', '''  padding: var(--lcl-spacing-sm);\n}\n\n.automation-metrics span,'''),
('''.dashboard-header,\n  .automation-card__header,\n  .automation-card__footer {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .dashboard-header .primary-action,\n  .automation-card__footer .secondary-action {\n    width: 100%;\n  }''', '''.dashboard-header {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .dashboard-header .primary-action {\n    width: 100%;\n  }'''),
('''\n  .automation-metrics > div:last-child {\n    grid-column: 1 / -1;\n  }\n''', '\n')
]
for old, new in replacements:
    assert old in s, old
    s = s.replace(old, new, 1)
p.write_text(s)
