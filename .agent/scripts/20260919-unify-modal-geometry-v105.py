from pathlib import Path
import json
import re

ROOT = Path('.')

# 1. Authoritative geometry tokens.
tokens_path = ROOT / 'packages/design-tokens/tokens/tokens.json'
tokens = json.loads(tokens_path.read_text())
size = tokens.setdefault('size', {})
size['modalMaxWidth'] = '42rem'
size['modalHeight'] = '36rem'
size['modalViewportInset'] = '0.5rem'
size.pop('modalWorkspaceMinHeight', None)
tokens_path.write_text(json.dumps(tokens, indent=2, ensure_ascii=False) + '\n')

# 2. Modal has one geometry contract: remove size API and variant class names.
modal_path = ROOT / 'packages/ui/src/primitives/Modal.tsx'
modal = modal_path.read_text()
modal = re.sub(r"\n\s*size\?: 'default' \| 'diagnostic' \| 'task' \| 'workspace';", '', modal, count=1)
modal = modal.replace("  size = 'default',\n", '')
modal = modal.replace('className={`lcl-modal-backdrop lcl-modal-backdrop--${size}`}', 'className="lcl-modal-backdrop"')
modal = modal.replace('className={`lcl-modal lcl-modal--${size}`}', 'className="lcl-modal"')
if 'lcl-modal--${size}' in modal or 'lcl-modal-backdrop--${size}' in modal or 'size?:' in modal:
    raise SystemExit('Modal size API cleanup incomplete')
modal_path.write_text(modal)

# 3. Remove legacy size props only while inside shared <Modal> blocks.
changed_modal_consumers = []
for path in (ROOT / 'apps/mobile/src').rglob('*.tsx'):
    source = path.read_text()
    lines = source.splitlines(keepends=True)
    depth = 0
    changed = False
    output = []
    for line in lines:
        opens = len(re.findall(r'<Modal\b', line))
        closes = line.count('</Modal>')
        depth += opens
        if depth > 0 and re.search(r'\bsize="(?:default|diagnostic|task|workspace)"', line):
            new_line = re.sub(r'\s*size="(?:default|diagnostic|task|workspace)"', '', line)
            # Preserve a standalone prop line as a newline only when necessary; prettier cleans it.
            if new_line.strip() == '':
                new_line = ''
            line = new_line
            changed = True
        output.append(line)
        depth -= closes
        if depth < 0:
            raise SystemExit(f'Unexpected Modal depth while processing {path}')
    if depth != 0:
        raise SystemExit(f'Unbalanced Modal markup while processing {path}')
    if changed:
        path.write_text(''.join(output))
        changed_modal_consumers.append(str(path))

# 4. Canonical shared modal CSS. Geometry comes only from design tokens.
ui_styles_path = ROOT / 'packages/ui/src/styles.css'
ui_styles = ui_styles_path.read_text()
marker = '.lcl-modal-backdrop {'
idx = ui_styles.find(marker)
if idx == -1:
    raise SystemExit('Modal CSS marker missing')
prefix = ui_styles[:idx]
canonical_modal_css = '''.lcl-modal-backdrop {
  align-items: center;
  background: var(--lcl-color-overlay);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: var(--lcl-size-modal-viewport-inset);
  position: fixed;
  z-index: var(--lcl-z-index-modal);
}

.lcl-modal {
  background: var(--lcl-color-surface);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-lg);
  box-shadow: var(--lcl-shadow-lg);
  box-sizing: border-box;
  color: var(--lcl-color-text);
  display: grid;
  gap: var(--lcl-spacing-lg);
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: min(
    var(--lcl-size-modal-height),
    calc(
      100vh - var(--lcl-size-modal-viewport-inset) -
        var(--lcl-size-modal-viewport-inset)
    )
  );
  height: min(
    var(--lcl-size-modal-height),
    calc(
      100dvh - var(--lcl-size-modal-viewport-inset) -
        var(--lcl-size-modal-viewport-inset)
    )
  );
  overflow: hidden;
  padding: var(--lcl-spacing-xl);
  width: min(
    var(--lcl-size-modal-max-width),
    calc(
      100vw - var(--lcl-size-modal-viewport-inset) -
        var(--lcl-size-modal-viewport-inset)
    )
  );
}

.lcl-modal__header {
  align-items: flex-start;
  display: flex;
  gap: var(--lcl-spacing-lg);
  justify-content: space-between;
}

.lcl-modal__heading {
  min-width: 0;
}

.lcl-modal__title-row {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.lcl-modal__title-row h2 {
  min-width: 0;
  overflow-wrap: anywhere;
}

.lcl-modal__header-actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: var(--lcl-spacing-sm);
}

.lcl-modal__header h2 {
  font-size: var(--lcl-font-size-2xl);
  line-height: var(--lcl-line-height-tight);
  margin: 0;
}

.lcl-modal__header p {
  color: var(--lcl-color-text-muted);
  line-height: var(--lcl-line-height-relaxed);
  margin: var(--lcl-spacing-xs) 0 0;
}

.lcl-modal__body {
  align-content: start;
  display: grid;
  gap: var(--lcl-spacing-md);
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.lcl-modal__footer {
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  display: flex;
  flex-wrap: wrap;
  gap: var(--lcl-spacing-sm);
  justify-content: flex-end;
  padding-top: var(--lcl-spacing-md);
}

.lcl-modal__close {
  align-items: center;
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: var(--lcl-font-size-lg);
  font-weight: var(--lcl-font-weight-bold);
  justify-content: center;
  min-height: var(--lcl-size-control-min-height);
  padding: 0 var(--lcl-spacing-lg);
}

@media (max-width: 44rem) {
  .lcl-toast-viewport {
    justify-items: stretch;
  }

  .lcl-modal {
    padding: var(--lcl-fluid-panel-padding);
  }

  .lcl-modal__footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .lcl-modal__footer > * {
    width: 100%;
  }

  .lcl-modal__close {
    width: 100%;
  }
}
'''
ui_styles_path.write_text(prefix + canonical_modal_css)

# 5. Quality gate now enforces the one-modal geometry contract.
ux_path = ROOT / 'scripts/quality/ux-gate.mjs'
ux = ux_path.read_text()
start = ux.index('const checkModalSizingPatterns = async () => {')
end_marker = '\nconst checkThemeTokenPatterns = async () => {'
end = ux.index(end_marker, start)
new_check = '''const checkModalSizingPatterns = async () => {
  const uiThemePath = 'packages/ui/src/styles.css';
  const modalPath = 'packages/ui/src/primitives/Modal.tsx';
  const tokenCssPath = 'packages/design-tokens/src/styles.css';
  const tokenSourcePath = 'packages/design-tokens/tokens/tokens.json';
  const uiTheme = await readRepoFile(uiThemePath);
  const modalSource = await readRepoFile(modalPath);
  const tokenCss = await readRepoFile(tokenCssPath);
  const tokenSource = JSON.parse(await readRepoFile(tokenSourcePath));

  const expectedGeometry = {
    modalMaxWidth: '42rem',
    modalHeight: '36rem',
    modalViewportInset: '0.5rem'
  };
  for (const [token, expected] of Object.entries(expectedGeometry)) {
    if (tokenSource.size?.[token] !== expected) {
      addFailure(
        tokenSourcePath,
        `canonical modal token size.${token} must equal ${expected}`
      );
    }
    const cssName = token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    if (!tokenCss.includes(`--lcl-size-${cssName}: ${expected};`)) {
      addFailure(tokenCssPath, `generated modal token --lcl-size-${cssName} is missing`);
    }
    if (!uiTheme.includes(`var(--lcl-size-${cssName})`)) {
      addFailure(uiThemePath, `shared modal geometry must consume --lcl-size-${cssName}`);
    }
  }

  if ('modalWorkspaceMinHeight' in (tokenSource.size ?? {})) {
    addFailure(
      tokenSourcePath,
      'legacy modalWorkspaceMinHeight token must not exist; all modals share one geometry'
    );
  }

  if (/\.lcl-modal(?:-backdrop)?--/.test(uiTheme)) {
    addFailure(
      uiThemePath,
      'modal size modifier classes are forbidden; every modal must use the canonical geometry'
    );
  }

  if (
    modalSource.includes('size?:') ||
    modalSource.includes("size = 'default'") ||
    modalSource.includes('lcl-modal--${') ||
    modalSource.includes('lcl-modal-backdrop--${')
  ) {
    addFailure(modalPath, 'Modal must not expose or render size variants');
  }

  const mobileTsxPaths = (await listRepoFiles('apps/mobile/src')).filter((path) =>
    path.endsWith('.tsx')
  );
  for (const path of mobileTsxPaths) {
    const source = await readRepoFile(path);
    if (/\bsize=["'](?:default|diagnostic|task|workspace)["']/.test(source)) {
      addFailure(
        path,
        'legacy modal size variants are forbidden; use the shared Modal geometry without size'
      );
    }
  }
};
'''
ux_path.write_text(ux[:start] + new_check + ux[end:])

# 6. Tests / responsive contract follow the canonical class instead of variants.
automation_test = ROOT / 'apps/mobile/src/__tests__/automation-detail.test.tsx'
text = automation_test.read_text()
text = text.replace(
    "    expect(dialog).toHaveClass('lcl-modal--default');\n    expect(dialog).not.toHaveClass('lcl-modal--workspace');\n",
    "    expect(dialog).toHaveClass('lcl-modal');\n    expect(dialog.className).toBe('lcl-modal');\n"
)
automation_test.write_text(text)

hardware_test = ROOT / 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
text = hardware_test.read_text()
text = re.sub(
    r"expect\(([^\n]+)\)\.toHaveClass\('lcl-modal--(?:workspace|diagnostic|task|default)'\);",
    r"expect(\1).toHaveClass('lcl-modal');",
    text
)
hardware_test.write_text(text)

responsive_test = ROOT / 'apps/mobile/e2e/responsive.spec.ts'
text = responsive_test.read_text()
text = text.replace(
    "  expect(metrics.modalClassName).toContain('lcl-modal--workspace');",
    "  expect(metrics.modalClassName).toBe('lcl-modal');"
)
responsive_test.write_text(text)

# 7. Add a direct component regression check for the canonical shell classes.
modal_test = ROOT / 'apps/mobile/src/__tests__/modal.test.tsx'
text = modal_test.read_text()
anchor = "  it('blocks ambient dismissal while a modal is busy', () => {"
canonical_test = '''  it('renders one canonical modal shell without size variants', () => {\n    const onClose = vi.fn();\n    render(\n      <Modal closeLabel=\"Close\" open title=\"Canonical modal\" onClose={onClose}>\n        <p>Body</p>\n      </Modal>\n    );\n\n    const dialog = screen.getByRole('dialog', { name: 'Canonical modal' });\n    const backdrop = document.querySelector('.lcl-modal-backdrop');\n    expect(dialog.className).toBe('lcl-modal');\n    expect(backdrop?.className).toBe('lcl-modal-backdrop');\n  });\n\n'''
if canonical_test not in text:
    if anchor not in text:
        raise SystemExit('Modal test anchor missing')
    text = text.replace(anchor, canonical_test + anchor, 1)
modal_test.write_text(text)

# Catch stale production/test variant usage before checks.
stale = []
for base in [ROOT / 'apps/mobile/src', ROOT / 'apps/mobile/e2e', ROOT / 'packages/ui/src']:
    for path in base.rglob('*'):
        if not path.is_file() or path.suffix not in {'.ts', '.tsx', '.css'}:
            continue
        source = path.read_text()
        if 'lcl-modal--' in source or 'lcl-modal-backdrop--' in source:
            stale.append(str(path))
        if re.search(r'\bsize="(?:default|diagnostic|task|workspace)"', source):
            stale.append(str(path))
if stale:
    raise SystemExit('Stale modal variants remain: ' + ', '.join(sorted(set(stale))))

print('Unified modal geometry. Updated Modal consumers:', len(changed_modal_consumers))
for item in changed_modal_consumers:
    print(' -', item)
