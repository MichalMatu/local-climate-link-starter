from pathlib import Path

ROOT = Path('.')

def replace_once(path: str, old: str, new: str) -> None:
    file = ROOT / path
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'expected exactly one match in {path}, got {text.count(old)}')
    file.write_text(text.replace(old, new, 1))

# Climate detail: keep the useful title, remove duplicate eyebrows and the redundant
# "data source" row. Runtime truth is already represented by the live values/status.
replace_once(
    'apps/mobile/src/screens/InstallationDetailScreen.tsx',
    '''          <div className="installation-section-heading">\n            <div>\n              <p className="automation-card__eyebrow">{t('detail.currentState')}</p>\n              <h2>{t('detail.climateNow')}</h2>\n            </div>\n          </div>''',
    '''          <div className="installation-section-heading">\n            <h2>{t('detail.climateNow')}</h2>\n          </div>'''
)
replace_once(
    'apps/mobile/src/screens/InstallationDetailScreen.tsx',
    '''            <div>\n              <dt>{t('detail.source')}</dt>\n              <dd>{t('dashboard.liveFromShelly')}</dd>\n            </div>\n''',
    ''
)
replace_once(
    'apps/mobile/src/screens/InstallationDetailScreen.tsx',
    '''          <div className="installation-section-heading">\n            <div>\n              <p className="automation-card__eyebrow">{t('detail.configuration')}</p>\n              <h2>{t('detail.automation')}</h2>\n            </div>''',
    '''          <div className="installation-section-heading">\n            <div>\n              <h2>{t('detail.automation')}</h2>\n            </div>'''
)

# Time detail follows the same compact hierarchy.
replace_once(
    'apps/mobile/src/screens/TimeInstallationDetail.tsx',
    '''          <div className="installation-section-heading">\n            <div>\n              <p className="automation-card__eyebrow">{t('detail.currentState')}</p>\n              <h2>{t('time.scheduleSummary')}</h2>\n            </div>\n          </div>''',
    '''          <div className="installation-section-heading">\n            <h2>{t('time.scheduleSummary')}</h2>\n          </div>'''
)
replace_once(
    'apps/mobile/src/screens/TimeInstallationDetail.tsx',
    '''          <div className="installation-section-heading">\n            <div>\n              <p className="automation-card__eyebrow">{t('detail.configuration')}</p>\n              <h2>{t('time.detail.editTitle')}</h2>\n            </div>\n          </div>''',
    '''          <div className="installation-section-heading">\n            <h2>{t('time.detail.editTitle')}</h2>\n          </div>'''
)

# LED card: keep live configuration and actions; remove permanent helper prose that
# repeats what the controls and values already communicate.
replace_once(
    'apps/mobile/src/screens/ShellyLedSettingsCard.tsx',
    '''        <div>\n          <p className="automation-card__eyebrow">{copy.eyebrow}</p>\n          <h2>{copy.title}</h2>\n        </div>''',
    '''        <div>\n          <h2>{copy.title}</h2>\n        </div>'''
)
replace_once(
    'apps/mobile/src/screens/ShellyLedSettingsCard.tsx',
    '''\n      <p className="time-schedule-note">{copy.description}</p>\n''',
    '\n'
)
replace_once(
    'apps/mobile/src/screens/ShellyLedSettingsCard.tsx',
    '''\n          <p className="time-schedule-note">{copy.relayPresetHint}</p>\n''',
    '\n'
)

# Tighten only the detail stack. Dashboard spacing remains unchanged.
replace_once(
    'apps/mobile/src/theme/theme.css',
    '''.installation-detail-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);''',
    '''.installation-detail-grid {\n  display: grid;\n  gap: var(--lcl-spacing-sm);'''
)

# Shared shell should use the established layer token rather than a raw z-index.
replace_once(
    'apps/mobile/src/app/appShell.css',
    '  z-index: 20;\n',
    '  z-index: var(--lcl-z-index-header);\n'
)

print('detail compact polish v2 applied')
