from pathlib import Path

path = Path('apps/mobile/src/theme/theme.css')
text = path.read_text()

replacements = [
    (
        """.dashboard-kind-tabs {\n  background: var(--lcl-color-surface-muted);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-md);\n  display: grid;\n  gap: var(--lcl-spacing-xs);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  padding: var(--lcl-spacing-xs);\n}\n""",
        """.dashboard-kind-tabs {\n  background: var(--lcl-color-surface-muted);\n  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);\n  border-radius: var(--lcl-radius-md);\n  display: flex;\n  gap: var(--lcl-spacing-xs);\n  padding: var(--lcl-spacing-xs);\n}\n\n.dashboard-kind-tabs > * {\n  flex: 1 1 0;\n}\n""",
    ),
    (
        """.automation-summary {\n  gap: var(--lcl-spacing-sm) var(--lcl-spacing-md);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n""",
        """.automation-summary {\n  gap: var(--lcl-spacing-sm) var(--lcl-spacing-md);\n  grid-template-columns: repeat(\n    auto-fit,\n    minmax(min(100%, var(--lcl-size-action-min-width)), 1fr)\n  );\n}\n""",
    ),
    (
        """.automation-control-group {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n""",
        """.automation-control-group {\n  display: flex;\n}\n\n.automation-control-group > * {\n  flex: 1 1 0;\n}\n""",
    ),
    (
        """.automation-relay-actions {\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n""",
        """.automation-relay-actions {\n  display: flex;\n  gap: var(--lcl-spacing-sm);\n}\n\n.automation-relay-actions > * {\n  flex: 1 1 0;\n}\n""",
    ),
    ('@media (max-width: 48rem) {', '@media (max-width: 44rem) {'),
    ('    z-index: 18;', '    z-index: var(--lcl-z-index-header);'),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'missing UX-gate correction marker: {old[:100]!r}')
    text = text.replace(old, new, 1)

if 'grid-template-columns: repeat(2, minmax(0, 1fr));' in text:
    raise SystemExit('fixed two-column grid remains after UX-gate correction')
if '@media (max-width: 48rem)' in text:
    raise SystemExit('non-token 48rem breakpoint remains after UX-gate correction')
if 'z-index: 18;' in text:
    raise SystemExit('raw dashboard z-index remains after UX-gate correction')

path.write_text(text)
print('dashboard UX gate correction applied')
