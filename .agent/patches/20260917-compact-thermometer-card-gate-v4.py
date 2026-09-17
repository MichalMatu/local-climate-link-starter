from pathlib import Path

p = Path('apps/mobile/src/theme/theme.css')
text = p.read_text()
old = """\n@media (max-width: 23rem) {\n  .sensor-status-strip {\n    gap: var(--lcl-spacing-sm);\n  }\n\n  .sensor-status-strip__item {\n    font-size: var(--lcl-font-size-xs);\n  }\n}\n"""
if old not in text:
    raise SystemExit('breakpoint block missing')
p.write_text(text.replace(old, '\n', 1))
