from pathlib import Path

css_path = Path('apps/mobile/src/theme/theme.css')
css = css_path.read_text()

fixed_threshold = '''.rule-threshold-row {
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
'''
responsive_threshold = '''.rule-threshold-row {
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(45%, var(--lcl-size-form-column-min)), 1fr)
  );
}
'''
if fixed_threshold not in css:
    raise SystemExit('fixed threshold grid anchor not found')
css = css.replace(fixed_threshold, responsive_threshold, 1)

fixed_developer = '''.rule-developer-actions--compact {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}
'''
responsive_developer = '''.rule-developer-actions--compact {
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(45%, var(--lcl-size-action-min-width)), 1fr)
  );
  width: 100%;
}
'''
if fixed_developer not in css:
    raise SystemExit('fixed developer grid anchor not found')
css = css.replace(fixed_developer, responsive_developer, 1)

css_path.write_text(css)
print('Converted rule setup pairs to tokenized responsive auto-fit grids')
