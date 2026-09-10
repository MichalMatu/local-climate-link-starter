from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"missing marker in {path}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1))


intent = Path('apps/mobile/src/screens/SetupIntentScreen.tsx')
replace_once(
    intent,
    """      <header className=\"demo-header intent-header\">\n        <div>\n          <p className=\"demo-kicker\">Local Climate Link</p>\n          <h1>{t('intent.title')}</h1>\n          <p>{t('intent.description')}</p>\n        </div>\n      </header>\n""",
    """      <header className=\"demo-header intent-header\">\n        <div>\n          <h1>{t('intent.title')}</h1>\n        </div>\n      </header>\n""",
)
replace_once(
    intent,
    """              <strong>{t(choice.titleKey)}</strong>\n              <span>{t(choice.descriptionKey)}</span>\n              <span className=\"intent-choice__action\" aria-hidden=\"true\">\n                {t('intent.open')}\n              </span>\n""",
    """              <span className=\"intent-choice__copy\">\n                <strong>{t(choice.titleKey)}</strong>\n                <span>{t(choice.descriptionKey)}</span>\n              </span>\n              <span className=\"intent-choice__action\" aria-hidden=\"true\">\n                ›\n              </span>\n""",
)

detail = Path('apps/mobile/src/screens/InstallationDetailScreen.tsx')
replace_once(detail, "          <p>{t('detail.description')}</p>\n", "")

time_detail = Path('apps/mobile/src/screens/TimeInstallationDetail.tsx')
replace_once(time_detail, "          <p>{t('time.detail.description')}</p>\n", "")

led = Path('apps/mobile/src/screens/ShellyLedSettingsCard.tsx')
text = led.read_text()
import_marker = "import { useTranslation } from '../app/i18n.js';\n"
if "../components/RefreshIconButton.js" not in text:
    if import_marker not in text:
        raise SystemExit('LED import marker missing')
    text = text.replace(
        import_marker,
        import_marker + "import { RefreshIconButton } from '../components/RefreshIconButton.js';\n",
        1,
    )
old_refresh = """        <button\n          className=\"secondary-action\"\n          type=\"button\"\n          disabled={settingsQuery.isFetching}\n          onClick={() => void settingsQuery.refetch()}\n        >\n          {t('common.refresh')}\n        </button>\n"""
new_refresh = """        <RefreshIconButton\n          busy={settingsQuery.isFetching}\n          label={t('common.refresh')}\n          onRefresh={() => void settingsQuery.refetch()}\n        />\n"""
if old_refresh not in text:
    raise SystemExit('LED refresh marker missing')
led.write_text(text.replace(old_refresh, new_refresh, 1))

css = Path('apps/mobile/src/theme/theme.css')
text = css.read_text()
old_intent = """.intent-shell {\n  align-content: center;\n}\n\n.intent-header {\n  max-width: var(--lcl-size-prose-max-width);\n}\n\n.intent-choice-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-card-column-min)), 1fr)\n  );\n}\n\n.intent-choice {\n  background: var(--lcl-color-surface);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-lg);\n  box-shadow: var(--lcl-shadow-md);\n  color: var(--lcl-color-text);\n  cursor: pointer;\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  padding: var(--lcl-fluid-panel-padding);\n  text-align: left;\n}\n\n.intent-choice:hover,\n.intent-choice:focus-visible {\n  border-color: var(--lcl-color-accent);\n}\n\n.intent-choice strong {\n  font-size: var(--lcl-font-size-xl);\n  line-height: var(--lcl-line-height-tight);\n}\n\n.intent-choice span {\n  color: var(--lcl-color-text-muted);\n  line-height: var(--lcl-line-height-relaxed);\n}\n\n.intent-choice .intent-choice__action {\n  color: var(--lcl-color-accent);\n  font-size: var(--lcl-font-size-sm);\n  font-weight: 800;\n  margin-top: var(--lcl-spacing-sm);\n}\n"""
new_intent = """.intent-shell {\n  align-content: center;\n  gap: var(--lcl-spacing-lg);\n}\n\n.intent-header {\n  max-width: var(--lcl-size-prose-max-width);\n}\n\n.intent-choice-grid {\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-card-column-min)), 1fr)\n  );\n}\n\n.intent-choice {\n  align-items: center;\n  background: var(--lcl-color-surface);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-lg);\n  box-shadow: none;\n  color: var(--lcl-color-text);\n  cursor: pointer;\n  display: grid;\n  gap: var(--lcl-spacing-md);\n  grid-template-columns: minmax(0, 1fr) auto;\n  padding: var(--lcl-spacing-md);\n  text-align: left;\n}\n\n.intent-choice:hover,\n.intent-choice:focus-visible {\n  border-color: var(--lcl-color-accent);\n}\n\n.intent-choice__copy {\n  display: grid;\n  gap: var(--lcl-spacing-xs);\n  min-width: 0;\n}\n\n.intent-choice strong {\n  color: var(--lcl-color-text);\n  font-size: var(--lcl-font-size-xl);\n  line-height: var(--lcl-line-height-tight);\n}\n\n.intent-choice__copy > span {\n  color: var(--lcl-color-text-muted);\n  font-size: var(--lcl-font-size-sm);\n  line-height: var(--lcl-line-height-normal);\n}\n\n.intent-choice .intent-choice__action {\n  color: var(--lcl-color-accent);\n  font-size: var(--lcl-font-size-2xl);\n  font-weight: 800;\n  line-height: 1;\n}\n"""
if old_intent not in text:
    raise SystemExit('intent CSS marker missing')
text = text.replace(old_intent, new_intent, 1)

text = text.replace(
    """.installation-detail-shell {\n  align-content: start;\n}\n\n.installation-detail-header {\n  align-items: flex-start;\n}\n\n.installation-detail-header > div {\n  min-width: 0;\n}\n""",
    """.installation-detail-shell {\n  align-content: start;\n  gap: var(--lcl-spacing-md);\n}\n\n.installation-detail-header {\n  align-items: center;\n}\n\n.installation-detail-header > div {\n  display: grid;\n  gap: var(--lcl-spacing-xs);\n  min-width: 0;\n}\n\n.installation-detail-header h1 {\n  font-size: var(--lcl-font-size-2xl);\n  line-height: var(--lcl-line-height-tight);\n}\n""",
    1,
)
text = text.replace(
    """  font-weight: 800;\n  margin: 0 0 var(--lcl-spacing-md);\n  padding: 0;\n}\n\n.detail-back-link:hover,""",
    """  font-weight: 800;\n  margin: 0 0 var(--lcl-spacing-xs);\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding: 0;\n}\n\n.detail-back-link:hover,""",
    1,
)
text = text.replace(
    """.installation-detail-grid {\n  display: grid;\n  gap: var(--lcl-spacing-lg);\n""",
    """.installation-detail-grid {\n  display: grid;\n  gap: var(--lcl-spacing-md);\n""",
    1,
)
text = text.replace(
    """.installation-detail-summary {\n  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  padding-top: var(--lcl-spacing-md);\n}\n\n.installation-detail-actions {\n  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  padding-top: var(--lcl-spacing-md);\n}\n""",
    """.installation-detail-summary {\n  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  padding-top: var(--lcl-spacing-sm);\n}\n\n.installation-detail-actions {\n  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-action-min-width)), 1fr)\n  );\n  padding-top: var(--lcl-spacing-sm);\n  width: 100%;\n}\n\n.installation-detail-actions > * {\n  width: 100%;\n}\n\n.installation-detail-config .time-schedule-grid {\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-form-column-min)), 1fr)\n  );\n}\n""",
    1,
)
text = text.replace(
    """  color: var(--lcl-color-status-warning-text);\n  margin: 0;\n  padding: var(--lcl-spacing-md);\n}\n\n@media (max-width: 44rem) {""",
    """  color: var(--lcl-color-status-warning-text);\n  margin: 0;\n  padding: var(--lcl-spacing-sm);\n}\n\n@media (max-width: 44rem) {""",
    1,
)
old_mobile = """@media (max-width: 30rem) {\n  .automation-card__actions,\n  .installation-detail-actions,\n  .installation-section-heading {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .automation-card__actions .secondary-action,\n  .installation-detail-actions .primary-action,\n  .installation-detail-actions .secondary-action,\n  .installation-section-heading .secondary-action {\n    width: 100%;\n  }\n}\n"""
new_mobile = """@media (max-width: 30rem) {\n  .automation-card__actions {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .automation-card__actions .secondary-action {\n    width: 100%;\n  }\n}\n"""
if old_mobile not in text:
    raise SystemExit('detail mobile CSS marker missing')
text = text.replace(old_mobile, new_mobile, 1)
css.write_text(text)

print('detail and intent visual polish v1 applied')
