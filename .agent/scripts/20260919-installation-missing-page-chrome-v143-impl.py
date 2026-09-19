from pathlib import Path

replacements = {
    Path('apps/mobile/src/screens/InstallationDetailScreen.tsx'): (
        """  if (!installation) {\n    return (\n      <main className=\"demo-shell installation-detail-shell\">\n        <header className=\"demo-header installation-detail-header\">\n          <div>\n            <p className=\"demo-kicker\">Local Climate Link</p>\n            <h1>{t('detail.notFoundTitle')}</h1>\n            <p>{t('detail.notFoundDescription')}</p>\n          </div>\n          <button className=\"secondary-action\" type=\"button\" onClick={onBack}>\n            {t('detail.backToDashboard')}\n          </button>\n        </header>\n      </main>\n    );\n  }\n""",
        """  if (!installation) {\n    return (\n      <main className=\"demo-shell installation-detail-shell\">\n        <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />\n        <section className=\"automation-card installation-detail-identity\">\n          <div className=\"installation-detail-identity__copy\">\n            <h1>{t('detail.notFoundTitle')}</h1>\n            <p className=\"installation-detail-note\">{t('detail.notFoundDescription')}</p>\n          </div>\n        </section>\n      </main>\n    );\n  }\n""",
    ),
    Path('apps/mobile/src/screens/InstallationDiagnosticsScreen.tsx'): (
        """    return (\n      <main className=\"demo-shell installation-detail-shell\">\n        <div className=\"setup-context\">\n          <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>\n            {t('detail.backToDashboard')}\n          </button>\n        </div>\n        <section className=\"automation-card\">\n          <h1>{t('detail.notFoundTitle')}</h1>\n        </section>\n      </main>\n    );\n""",
        """    return (\n      <main className=\"demo-shell installation-detail-shell\">\n        <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />\n        <section className=\"automation-card\">\n          <h1>{t('detail.notFoundTitle')}</h1>\n        </section>\n      </main>\n    );\n""",
    ),
    Path('apps/mobile/src/screens/InstallationScriptScreen.tsx'): (
        """    return (\n      <main className=\"demo-shell installation-detail-shell\">\n        <div className=\"setup-context\">\n          <button className=\"setup-context__back\" type=\"button\" onClick={onBack}>\n            {t('detail.backToDashboard')}\n          </button>\n        </div>\n        <section className=\"automation-card\">\n          <h1>{t('detail.notFoundTitle')}</h1>\n        </section>\n      </main>\n    );\n""",
        """    return (\n      <main className=\"demo-shell installation-detail-shell\">\n        <AppPageBack label={t('dashboard.climateTab')} onBack={onBack} />\n        <section className=\"automation-card\">\n          <h1>{t('detail.notFoundTitle')}</h1>\n        </section>\n      </main>\n    );\n""",
    ),
}

for path, (old, new) in replacements.items():
    text = path.read_text()
    if old not in text:
        raise SystemExit(f'target block not found: {path}')
    path.write_text(text.replace(old, new, 1))
    print(f'Patched {path}')
