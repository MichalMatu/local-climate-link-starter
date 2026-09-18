from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


# Canonical shared contextual-info primitive.
old_info = Path('packages/ui/src/feedback/InfoTooltip.tsx')
new_info = Path('packages/ui/src/feedback/InfoPopover.tsx')
if not old_info.exists():
    raise SystemExit('InfoTooltip.tsx missing')
if new_info.exists():
    raise SystemExit('InfoPopover.tsx already exists')
new_info.write_text("""import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface InfoPopoverProps {
  label: string;
  title?: string;
  children: ReactNode;
}

export const InfoPopover = ({ label, title, children }: InfoPopoverProps) => {
  const popoverId = useId();
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const closeWhenOutside = (target: EventTarget | null) => {
      if (target instanceof Node && popoverRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => closeWhenOutside(event.target);
    const handleFocusIn = (event: FocusEvent) => closeWhenOutside(event.target);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <span className="lcl-info-popover" ref={popoverRef}>
      <button
        aria-controls={isOpen ? popoverId : undefined}
        aria-describedby={isOpen ? popoverId : undefined}
        aria-expanded={isOpen}
        aria-label={label}
        className="lcl-info-popover__trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span aria-hidden="true">i</span>
      </button>
      {isOpen && (
        <span
          aria-label={title ?? label}
          className="lcl-info-popover__bubble"
          id={popoverId}
          role="tooltip"
        >
          {title && <strong>{title}</strong>}
          <span className="lcl-info-popover__content">{children}</span>
        </span>
      )}
    </span>
  );
};
""")
old_info.unlink()

index_path = Path('packages/ui/src/index.ts')
text = index_path.read_text()
text = replace_once(
    text,
    "export * from './feedback/InfoTooltip.js';",
    "export * from './feedback/InfoPopover.js';",
    'ui barrel info export',
)
index_path.write_text(text)

styles_path = Path('packages/ui/src/styles.css')
text = styles_path.read_text()
start = text.find('.lcl-info-tooltip {')
end = text.find('\n.lcl-metrics,', start)
if start == -1 or end == -1:
    raise SystemExit('info tooltip css block not found')
new_css = """.lcl-info-popover {
  display: inline-flex;
  position: relative;
}

.lcl-info-popover__trigger {
  align-items: center;
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-round);
  color: var(--lcl-color-text);
  cursor: help;
  display: inline-flex;
  font: inherit;
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-bold);
  height: var(--lcl-size-toast-dismiss-size);
  justify-content: center;
  line-height: 1;
  padding: 0;
  width: var(--lcl-size-toast-dismiss-size);
}

.lcl-info-popover__trigger:hover,
.lcl-info-popover__trigger:focus-visible {
  border-color: var(--lcl-color-accent);
}

.lcl-info-popover__bubble {
  background: var(--lcl-color-surface);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  border-radius: var(--lcl-radius-md);
  box-shadow: var(--lcl-shadow-lg);
  box-sizing: border-box;
  color: var(--lcl-color-text);
  display: grid;
  font-size: var(--lcl-font-size-sm);
  gap: var(--lcl-spacing-xs);
  line-height: var(--lcl-line-height-normal);
  max-width: min(
    var(--lcl-size-tooltip-max-width),
    calc(100vw - (var(--lcl-spacing-lg) * 2))
  );
  overflow-wrap: anywhere;
  padding: var(--lcl-spacing-md);
  position: absolute;
  right: 0;
  top: calc(100% + var(--lcl-spacing-sm));
  width: min(
    var(--lcl-size-tooltip-max-width),
    calc(100vw - (var(--lcl-spacing-lg) * 2))
  );
  z-index: var(--lcl-z-index-toast);
}

.lcl-info-popover__bubble strong {
  font-size: var(--lcl-font-size-sm);
  line-height: var(--lcl-line-height-compact);
}

.lcl-info-popover__content {
  color: var(--lcl-color-text-muted);
}
"""
text = text[:start] + new_css + text[end:]
styles_path.write_text(text)

# Existing Shelly contextual help uses the canonical primitive.
for raw_path in [
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
    'apps/mobile/src/screens/hardware-setup/pages/ShellyBleDiscoveryModal.tsx',
]:
    path = Path(raw_path)
    text = path.read_text()
    if text.count('InfoTooltip') != 3:
        raise SystemExit(f'unexpected InfoTooltip count in {raw_path}: {text.count("InfoTooltip")}')
    path.write_text(text.replace('InfoTooltip', 'InfoPopover'))

# Rule contextual help becomes in-place popovers rather than standalone modals.
rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
text = replace_once(
    text,
    "import { FeedbackPanel, Modal, ScriptPreview, SelectField, ToastViewport } from '@lcl/ui';",
    "import { FeedbackPanel, InfoPopover, Modal, ScriptPreview, SelectField, ToastViewport } from '@lcl/ui';",
    'RuleSetupPage ui import',
)
text = replace_once(
    text,
    "import { IconInfoCircle, IconTrash } from '@tabler/icons-react';",
    "import { IconTrash } from '@tabler/icons-react';",
    'RuleSetupPage icon import',
)
text = replace_once(
    text,
    """          <button
            aria-label={t('hardware.rule.summaryTitle')}
            className="icon-action rule-summary-icon-action"
            type="button"
            title={t('hardware.rule.summaryTitle')}
            onClick={() => setDialog('summary')}
          >
            <IconInfoCircle className="icon-action__svg" aria-hidden="true" />
          </button>""",
    """          <InfoPopover
            label={t('hardware.rule.summaryTitle')}
            title={t('hardware.rule.summaryTitle')}
          >
            {ruleSummary}
          </InfoPopover>""",
    'rule summary info trigger',
)
text = replace_once(
    text,
    """            <button
              aria-label={t('hardware.rule.vpdAssistHint')}
              className="icon-action rule-summary-icon-action"
              type="button"
              title={t('hardware.rule.vpdAssistHint')}
              onClick={() => setDialog('vpd-info')}
            >
              <IconInfoCircle className="icon-action__svg" aria-hidden="true" />
            </button>""",
    """            <InfoPopover
              label={t('hardware.rule.vpdAssistHint')}
              title={t('hardware.rule.vpdAssistTitle')}
            >
              {t('hardware.rule.vpdAssistHint')}
              <br />
              <br />
              {t('hardware.rule.vpdRangeHint')}
            </InfoPopover>""",
    'VPD info trigger',
)
text = replace_once(
    text,
    """      <Modal
        closeLabel={t('common.close')}
        open={dialog === 'summary'}
        title={t('hardware.rule.summaryTitle')}
        onClose={() => setDialog('none')}
      >
        <p>{ruleSummary}</p>
      </Modal>
      <Modal
        closeLabel={t('common.close')}
        open={dialog === 'vpd-info'}
        title={t('hardware.rule.vpdAssistTitle')}
        onClose={() => setDialog('none')}
      >
        <>
          <p>{t('hardware.rule.vpdAssistHint')}</p>
          <p>{t('hardware.rule.vpdRangeHint')}</p>
        </>
      </Modal>
""",
    '',
    'rule contextual info modals',
)
rule_path.write_text(text)

feedback_path = Path('apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts')
text = feedback_path.read_text()
text = replace_once(
    text,
    "export type RuleDialogState =\n  'none' | 'summary' | 'vpd-info' | 'script' | 'delete' | 'install-block' | 'relay-test';",
    "export type RuleDialogState =\n  'none' | 'script' | 'delete' | 'install-block' | 'relay-test';",
    'RuleDialogState contextual states',
)
feedback_path.write_text(text)

# Shelly device info action is actually full settings, so use a settings glyph.
shelly_presentation_path = Path(
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx'
)
text = shelly_presentation_path.read_text()
if text.count('IconInfoCircle') != 2:
    raise SystemExit(f'unexpected Shelly settings info icon count: {text.count("IconInfoCircle")}')
shelly_presentation_path.write_text(text.replace('IconInfoCircle', 'IconSettings'))

# Tests follow the common popover interaction rather than modal semantics.
test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = test_path.read_text()
text = replace_once(
    text,
    """const getRuleSummary = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Podsumowanie reguły' }));
  const dialog = screen.getByRole('dialog', { name: 'Podsumowanie reguły' });
  const snapshot = document.createElement('article');
  snapshot.textContent = dialog.textContent;
  fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
  return snapshot;
};""",
    """const getRuleSummary = () => {
  const trigger = screen.getByRole('button', { name: 'Podsumowanie reguły' });
  fireEvent.click(trigger);
  const popover = screen.getByRole('tooltip', { name: 'Podsumowanie reguły' });
  const snapshot = document.createElement('article');
  snapshot.textContent = popover.textContent;
  fireEvent.click(trigger);
  return snapshot;
};""",
    'rule summary test helper',
)
text = replace_once(
    text,
    "it('shows Shelly scan help as a compact tooltip', async () => {",
    "it('shows Shelly scan help in the shared info popover', async () => {",
    'Shelly scan help test title',
)
text = replace_once(
    text,
    """    fireEvent.click(tooltipButton);
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(tooltipButton);
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'false');

    expect(within(dialog).getByText('Skanowanie Shelly')).toBeInTheDocument();
    expect(within(dialog).getByText(/192\\.168\\.33\\.1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/oznacza je jako Dodane/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Zakres: 254 adresy.*1 min 36 s/)
    ).toBeInTheDocument();""",
    """    fireEvent.click(tooltipButton);
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'true');
    const scanInfoPopover = within(dialog).getByRole('tooltip', {
      name: 'Skanowanie Shelly'
    });
    expect(within(scanInfoPopover).getByText(/192\\.168\\.33\\.1/)).toBeInTheDocument();
    expect(within(scanInfoPopover).getByText(/oznacza je jako Dodane/i)).toBeInTheDocument();
    expect(
      within(scanInfoPopover).getByText(/Zakres: 254 adresy.*1 min 36 s/)
    ).toBeInTheDocument();""",
    'Shelly scan popover open assertions',
)
text = replace_once(
    text,
    """    expect(within(dialog).getByText(/Zakres: 32 adresy.*12 s/)).toBeInTheDocument();""",
    """    expect(
      within(scanInfoPopover).getByText(/Zakres: 32 adresy.*12 s/)
    ).toBeInTheDocument();""",
    'Shelly scan dynamic estimate assertion',
)
text = replace_once(
    text,
    """    fireEvent.click(within(dialog).getByRole('button', { name: 'STA' }));
    expect(within(dialog).getByLabelText('Od')).toHaveValue('192.168.0.1');
    expect(within(dialog).getByLabelText('Do')).toHaveValue('192.168.0.254');
  });""",
    """    fireEvent.click(within(dialog).getByRole('button', { name: 'STA' }));
    expect(within(dialog).getByLabelText('Od')).toHaveValue('192.168.0.1');
    expect(within(dialog).getByLabelText('Do')).toHaveValue('192.168.0.254');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(tooltipButton).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(dialog).queryByRole('tooltip', { name: 'Skanowanie Shelly' })
    ).not.toBeInTheDocument();
  });""",
    'Shelly scan popover close assertion',
)
text = replace_once(
    text,
    """      expect(vpdSection).not.toBeNull();
      expect(within(vpdSection as HTMLElement).getByRole('button')).toBeInTheDocument();

      expect(screen.getByLabelText('Włącz poniżej %')).toHaveValue(45);""",
    """      expect(vpdSection).not.toBeNull();
      const vpdInfoButton = within(vpdSection as HTMLElement).getByRole('button', {
        name: /Opcjonalnie koryguje punkt pracy/
      });
      fireEvent.click(vpdInfoButton);
      const vpdInfoPopover = within(vpdSection as HTMLElement).getByRole('tooltip', {
        name: 'VPD assist'
      });
      expect(
        within(vpdInfoPopover).getByText(/Nie zmienia limitów bezpieczeństwa/)
      ).toBeInTheDocument();
      expect(
        within(vpdInfoPopover).getByText(/Nie rozszerza zakresu/)
      ).toBeInTheDocument();
      fireEvent.click(vpdInfoButton);
      expect(
        within(vpdSection as HTMLElement).queryByRole('tooltip', { name: 'VPD assist' })
      ).not.toBeInTheDocument();

      expect(screen.getByLabelText('Włącz poniżej %')).toHaveValue(45);""",
    'VPD shared popover test',
)
test_path.write_text(text)

# Prevent ad-hoc mobile info glyphs from bypassing the shared primitive.
ux_path = Path('scripts/quality/ux-gate.mjs')
text = ux_path.read_text()
needle = """    if (/style=\\{\\{/.test(source)) {
      addFailure(
        path,
        'production mobile layout/style must use tokenized CSS classes, not inline style objects'
      );
    }
"""
addition = needle + """    if (source.includes('IconInfoCircle')) {
      addFailure(
        path,
        'contextual mobile info must use the shared @lcl/ui InfoPopover instead of ad-hoc IconInfoCircle buttons'
      );
    }
"""
text = replace_once(text, needle, addition, 'mobile info popover UX guard')
ux_path.write_text(text)

# Structural guards before running expensive tests.
for path in Path('apps/mobile/src').rglob('*.tsx'):
    if '__tests__' in path.parts or path.name.endswith(('.test.tsx', '.spec.tsx')):
        continue
    source = path.read_text()
    if 'InfoTooltip' in source:
        raise SystemExit(f'legacy InfoTooltip remains in {path}')
    if 'IconInfoCircle' in source:
        raise SystemExit(f'ad-hoc IconInfoCircle remains in {path}')

if old_info.exists():
    raise SystemExit('legacy InfoTooltip.tsx still exists')
if not new_info.exists():
    raise SystemExit('InfoPopover.tsx missing')

rule_source = rule_path.read_text()
for stale in ("setDialog('summary')", "setDialog('vpd-info')", "dialog === 'summary'", "dialog === 'vpd-info'"):
    if stale in rule_source:
        raise SystemExit(f'stale rule contextual modal state remains: {stale}')

print('Unified contextual info into shared InfoPopover and clarified Shelly settings action')
