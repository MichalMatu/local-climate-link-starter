from pathlib import Path

root = Path('.')

def replace_once(path: str, old: str, new: str) -> None:
    p = root / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:80]!r}')
    text2 = text.replace(old, new, 1)
    if text2 == text:
        raise SystemExit(f'no change in {path}')
    p.write_text(text2)

screen = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace_once(
    screen,
    "  IconAlertTriangle,\n  IconChevronRight,\n  IconClock,",
    "  IconAlertTriangle,\n  IconClock,"
)
replace_once(
    screen,
    "  } else if (query.isError || control.isError) {\n    warningLabel = t('dashboard.health.attention');\n  }",
    "  } else if (control.isError || (query.isError && !manualControl)) {\n    warningLabel = t('dashboard.health.attention');\n  }"
)
old_footer = '''      <footer className="automation-card__footer">\n        <button\n          className={`automation-card__status-link${\n            warningLabel ? ` automation-card__status-link--${warningClass}` : ''\n          }`}\n          type="button"\n          aria-label={t('dashboard.openSystem')}\n          onClick={() => onOpen(installation.id)}\n        >\n          <span className="automation-card__status-copy">\n            {warningLabel && <IconAlertTriangle aria-hidden="true" />}\n            <span>{warningLabel ?? t('dashboard.openSystem')}</span>\n          </span>\n          <IconChevronRight aria-hidden="true" />\n        </button>\n        {action.isError && (\n          <span className="automation-control-error" role="alert">\n            {t('detail.actionFailed')}\n          </span>\n        )}\n      </footer>'''
new_footer = '''      {(warningLabel || action.isError) && (\n        <footer className="automation-card__footer">\n          {warningLabel && (\n            <div\n              className={`automation-card__status automation-card__status--${warningClass}`}\n              role="status"\n            >\n              <IconAlertTriangle aria-hidden="true" />\n              <span>{warningLabel}</span>\n            </div>\n          )}\n          {action.isError && (\n            <span className="automation-control-error" role="alert">\n              {t('detail.actionFailed')}\n            </span>\n          )}\n        </footer>\n      )}'''
replace_once(screen, old_footer, new_footer)

css = 'apps/mobile/src/screens/AutomationDashboardScreen.css'
p = root / css
text = p.read_text()
start = text.find('.automation-card__status-link {')
end_marker = ".automation-card__status-link--offline {\n  color: var(--lcl-color-status-danger-text);\n}\n"
end = text.find(end_marker)
if start < 0 or end < 0:
    raise SystemExit('status link CSS block not found')
end += len(end_marker)
replacement = '''.automation-card__status {\n  align-items: center;\n  color: var(--lcl-color-text-muted);\n  display: flex;\n  font-size: var(--lcl-font-size-sm);\n  font-weight: var(--lcl-font-weight-semibold);\n  gap: var(--lcl-spacing-xs);\n  min-height: var(--lcl-size-compact-control-min-height);\n  padding-top: var(--lcl-spacing-xs);\n}\n\n.automation-card__status svg {\n  flex: 0 0 auto;\n  height: var(--lcl-size-control-icon-size);\n  width: var(--lcl-size-control-icon-size);\n}\n\n.automation-card__status--attention,\n.automation-card__status--stale,\n.automation-card__status--unknown {\n  color: var(--lcl-color-status-warning-text);\n}\n\n.automation-card__status--offline {\n  color: var(--lcl-color-status-danger-text);\n}\n'''
p.write_text(text[:start] + replacement + text[end:])

# Time card: the dashboard should use Tabler for every symbolic icon/chevron.
time = 'apps/mobile/src/screens/TimeAutomationCard.tsx'
p = root / time
text = p.read_text()
if "@tabler/icons-react" not in text:
    text = "import { IconChevronRight } from '@tabler/icons-react';\n" + text
old = '<span aria-hidden="true">›</span>'
new = '<IconChevronRight className="automation-card__detail-icon" aria-hidden="true" />'
if old not in text:
    raise SystemExit('time card text chevron not found')
text = text.replace(old, new, 1)
p.write_text(text)

# Climate dashboard test: details entry is now only the Tabler dots menu.
test = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
p = root / test
text = p.read_text()
old = "    expect(screen.getByRole('button', { name: 'Szczegóły' })).toBeVisible();"
new = "    expect(screen.getByRole('button', { name: 'Szczegóły: Salon' })).toBeVisible();"
if old not in text:
    raise SystemExit('climate details assertion not found')
text = text.replace(old, new, 1)
# Add explicit Tabler-only dashboard assertion to the live climate test.
anchor = "    expect(screen.getByRole('button', { name: 'Szczegóły: Salon' })).toBeVisible();\n"
insert = anchor + "    expect(document.querySelector('.automation-card__menu svg.tabler-icon')).not.toBeNull();\n    expect(document.querySelectorAll('.dashboard-shell svg:not(.tabler-icon)')).toHaveLength(0);\n"
if anchor not in text:
    raise SystemExit('tabler assertion anchor not found')
text = text.replace(anchor, insert, 1)
p.write_text(text)

# Manual mode with a stopped-script diagnostics failure is expected and must not become a fake warning.
controls_test = 'apps/mobile/src/__tests__/automation-dashboard-controls.test.tsx'
p = root / controls_test
text = p.read_text()
anchor = "    expect(screen.queryByRole('switch')).toBeNull();\n"
insert = anchor + "    expect(screen.queryByText('Wymaga uwagi')).toBeNull();\n"
if anchor not in text:
    raise SystemExit('controls test no-switch assertion not found')
text = text.replace(anchor, insert, 1)
p.write_text(text)

print('dashboard status/tabler cleanup applied')
