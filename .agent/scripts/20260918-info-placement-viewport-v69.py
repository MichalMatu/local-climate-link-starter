from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


# Shared label + contextual info pattern.
info_label_path = Path('packages/ui/src/feedback/InfoLabel.tsx')
if info_label_path.exists():
    raise SystemExit('InfoLabel.tsx already exists')
info_label_path.write_text("""import type { ReactNode } from 'react';
import { InfoPopover } from './InfoPopover.js';

export interface InfoLabelProps {
  label: ReactNode;
  infoLabel: string;
  title?: string;
  children: ReactNode;
  className?: string;
}

export const InfoLabel = ({
  label,
  infoLabel,
  title,
  children,
  className
}: InfoLabelProps) => (
  <span className={['lcl-info-label', className].filter(Boolean).join(' ')}>
    <span className="lcl-info-label__text">{label}</span>
    <InfoPopover label={infoLabel} title={title}>
      {children}
    </InfoPopover>
  </span>
);
""")

index_path = Path('packages/ui/src/index.ts')
text = index_path.read_text()
text = replace_once(
    text,
    "export * from './feedback/InfoPopover.js';\n",
    "export * from './feedback/InfoPopover.js';\nexport * from './feedback/InfoLabel.js';\n",
    'InfoLabel barrel export',
)
index_path.write_text(text)

# Make the shared popover position itself against the viewport instead of the trigger box.
info_path = Path('packages/ui/src/feedback/InfoPopover.tsx')
info_path.write_text("""import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';

export interface InfoPopoverProps {
  label: string;
  title?: string;
  children: ReactNode;
}

type PopoverPosition = {
  left: number;
  top: number;
};

const VIEWPORT_INSET_PX = 16;
const ANCHOR_GAP_PX = 8;

export const InfoPopover = ({ label, title, children }: InfoPopoverProps) => {
  const popoverId = useId();
  const popoverRef = useRef<HTMLSpanElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const maxLeft = Math.max(
      VIEWPORT_INSET_PX,
      window.innerWidth - VIEWPORT_INSET_PX - bubbleRect.width
    );
    const centeredLeft = triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2;
    const left = Math.min(maxLeft, Math.max(VIEWPORT_INSET_PX, centeredLeft));
    const belowTop = triggerRect.bottom + ANCHOR_GAP_PX;
    const aboveTop = triggerRect.top - ANCHOR_GAP_PX - bubbleRect.height;
    const top =
      belowTop + bubbleRect.height <= window.innerHeight - VIEWPORT_INSET_PX
        ? belowTop
        : Math.max(VIEWPORT_INSET_PX, aboveTop);

    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    updatePosition();
    const reposition = () => updatePosition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
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
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const bubbleStyle: CSSProperties = {
    left: position?.left ?? 0,
    top: position?.top ?? 0,
    visibility: position ? 'visible' : 'hidden'
  };

  return (
    <span className="lcl-info-popover" ref={popoverRef}>
      <button
        ref={triggerRef}
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
          ref={bubbleRef}
          aria-label={title ?? label}
          className="lcl-info-popover__bubble"
          id={popoverId}
          role="tooltip"
          style={bubbleStyle}
        >
          {title && <strong>{title}</strong>}
          <span className="lcl-info-popover__content">{children}</span>
        </span>
      )}
    </span>
  );
};
""")

# Modal title info is a first-class pattern, separate from right-edge header actions.
modal_path = Path('packages/ui/src/primitives/Modal.tsx')
text = modal_path.read_text()
text = replace_once(
    text,
    "import { useEffect, useId, useRef, type ReactNode } from 'react';",
    "import { useEffect, useId, useRef, type ReactNode } from 'react';\nimport { InfoPopover } from '../feedback/InfoPopover.js';",
    'Modal InfoPopover import',
)
text = replace_once(
    text,
    "type ModalInitialFocus = 'dialog' | 'first-control';\n\nexport interface ModalProps {",
    "type ModalInitialFocus = 'dialog' | 'first-control';\n\nexport interface ModalTitleInfo {\n  label: string;\n  title?: string;\n  content: ReactNode;\n}\n\nexport interface ModalProps {",
    'ModalTitleInfo interface',
)
text = replace_once(
    text,
    "  children: ReactNode;\n  headerActions?: ReactNode;",
    "  children: ReactNode;\n  titleInfo?: ModalTitleInfo;\n  headerActions?: ReactNode;",
    'Modal titleInfo prop',
)
text = replace_once(
    text,
    "  children,\n  headerActions,",
    "  children,\n  titleInfo,\n  headerActions,",
    'Modal titleInfo destructure',
)
text = replace_once(
    text,
    """          <div>\n            <h2 id={titleId}>{title}</h2>\n            {description && <p id={descriptionId}>{description}</p>}\n          </div>""",
    """          <div className=\"lcl-modal__heading\">\n            <div className=\"lcl-modal__title-row\">\n              <h2 id={titleId}>{title}</h2>\n              {titleInfo && (\n                <InfoPopover label={titleInfo.label} title={titleInfo.title}>\n                  {titleInfo.content}\n                </InfoPopover>\n              )}\n            </div>\n            {description && <p id={descriptionId}>{description}</p>}\n          </div>""",
    'Modal title row markup',
)
modal_path.write_text(text)

# Shared styles: labels stay adjacent, modal info sits beside title, bubble is viewport-fixed.
styles_path = Path('packages/ui/src/styles.css')
text = styles_path.read_text()
text = replace_once(
    text,
    ".lcl-info-popover {\n  display: inline-flex;\n  position: relative;\n}\n",
    ".lcl-info-label {\n  align-items: center;\n  display: inline-flex;\n  gap: var(--lcl-spacing-xs);\n  max-width: 100%;\n  width: fit-content;\n}\n\n.lcl-info-label__text {\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n\n.lcl-info-label > .lcl-info-popover {\n  flex: 0 0 auto;\n}\n\n.lcl-info-popover {\n  display: inline-flex;\n  position: relative;\n}\n",
    'InfoLabel styles',
)
text = replace_once(
    text,
    """  overflow-wrap: anywhere;\n  padding: var(--lcl-spacing-md);\n  position: absolute;\n  right: 0;\n  top: calc(100% + var(--lcl-spacing-sm));\n  width: min(\n    var(--lcl-size-tooltip-max-width),\n    calc(100vw - (var(--lcl-spacing-lg) * 2))\n  );\n  z-index: var(--lcl-z-index-toast);""",
    """  max-height: calc(100dvh - (var(--lcl-spacing-lg) * 2));\n  overflow-wrap: anywhere;\n  overflow-y: auto;\n  padding: var(--lcl-spacing-md);\n  position: fixed;\n  width: min(\n    var(--lcl-size-tooltip-max-width),\n    calc(100vw - (var(--lcl-spacing-lg) * 2))\n  );\n  z-index: var(--lcl-z-index-toast);""",
    'viewport-fixed popover CSS',
)
text = replace_once(
    text,
    ".lcl-modal__header-actions {\n  align-items: center;",
    ".lcl-modal__heading {\n  min-width: 0;\n}\n\n.lcl-modal__title-row {\n  align-items: center;\n  display: flex;\n  gap: var(--lcl-spacing-xs);\n  min-width: 0;\n}\n\n.lcl-modal__title-row h2 {\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n\n.lcl-modal__header-actions {\n  align-items: center;",
    'Modal title info styles',
)
text = text.replace("\n  .lcl-info-tooltip__bubble {\n    max-width: calc(100vw - (var(--lcl-spacing-lg) * 2));\n  }", "")
styles_path.write_text(text)

# Rule labels always use the shared label + info component.
rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
text = replace_once(text, 'InfoPopover,', 'InfoLabel,', 'RuleSetupPage InfoLabel import')
text = replace_once(
    text,
    """        <div className=\"rule-field-label-row\">\n          <span>{t('hardware.rule.ruleMode')}</span>\n          <InfoPopover\n            label={t('hardware.rule.summaryTitle')}\n            title={t('hardware.rule.summaryTitle')}\n          >\n            {ruleSummary}\n          </InfoPopover>\n        </div>""",
    """        <InfoLabel\n          label={t('hardware.rule.ruleMode')}\n          infoLabel={t('hardware.rule.summaryTitle')}\n          title={t('hardware.rule.summaryTitle')}\n        >\n          {ruleSummary}\n        </InfoLabel>""",
    'Rule mode InfoLabel',
)
text = replace_once(
    text,
    """          <div className=\"icon-action-row\">\n            <strong>{t('hardware.rule.vpdAssistTitle')}</strong>\n            <InfoPopover\n              label={t('hardware.rule.vpdAssistHint')}\n              title={t('hardware.rule.vpdAssistTitle')}\n            >\n              {t('hardware.rule.vpdAssistHint')}\n              <br />\n              <br />\n              {t('hardware.rule.vpdRangeHint')}\n            </InfoPopover>\n          </div>""",
    """          <InfoLabel\n            label={<strong>{t('hardware.rule.vpdAssistTitle')}</strong>}\n            infoLabel={t('hardware.rule.vpdAssistHint')}\n            title={t('hardware.rule.vpdAssistTitle')}\n          >\n            {t('hardware.rule.vpdAssistHint')}\n            <br />\n            <br />\n            {t('hardware.rule.vpdRangeHint')}\n          </InfoLabel>""",
    'VPD InfoLabel',
)
rule_path.write_text(text)

# Network scan help moves from the right header action edge to the modal title.
shelly_path = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
text = shelly_path.read_text()
old = """        headerActions={\n          <span className=\"shelly-network-scan__info\">\n            <InfoPopover\n              label={t('hardware.shelly.infoScanLabel')}\n              title={t('hardware.shelly.infoScanTitle')}\n            >\n              {shellyScanEstimate}\n              <br />\n              <br />\n              {t('hardware.shelly.scannerBehavior')}\n            </InfoPopover>\n          </span>\n        }"""
new = """        titleInfo={{\n          label: t('hardware.shelly.infoScanLabel'),\n          title: t('hardware.shelly.infoScanTitle'),\n          content: (\n            <>\n              {shellyScanEstimate}\n              <br />\n              <br />\n              {t('hardware.shelly.scannerBehavior')}\n            </>\n          )\n        }}"""
text = replace_once(text, old, new, 'Shelly network scan title info')
text = text.replace('  InfoPopover,\n', '')
shelly_path.write_text(text)

ble_path = Path('apps/mobile/src/screens/hardware-setup/pages/ShellyBleDiscoveryModal.tsx')
text = ble_path.read_text()
text = replace_once(
    text,
    "import { FeedbackPanel, InfoPopover, Modal } from '@lcl/ui';",
    "import { FeedbackPanel, Modal } from '@lcl/ui';",
    'BLE modal imports',
)
text = replace_once(
    text,
    """      headerActions={\n        <InfoPopover\n          label={t('hardware.shelly.scanBleInfoLabel')}\n          title={t('hardware.shelly.scanBleInfoTitle')}\n        >\n          {t('hardware.shelly.scanBleInfo')}\n        </InfoPopover>\n      }""",
    """      titleInfo={{\n        label: t('hardware.shelly.scanBleInfoLabel'),\n        title: t('hardware.shelly.scanBleInfoTitle'),\n        content: t('hardware.shelly.scanBleInfo')\n      }}""",
    'BLE modal title info',
)
ble_path.write_text(text)

# Remove the old Rule-specific right-edge label layout. Shared InfoLabel owns this now.
theme_path = Path('apps/mobile/src/theme/theme.css')
text = theme_path.read_text()
text = replace_once(
    text,
    """.rule-field-label-row {\n  align-items: center;\n  display: flex;\n  gap: var(--lcl-spacing-sm);\n  justify-content: space-between;\n}\n\n.rule-field-label-row > label {\n  color: var(--lcl-color-text);\n  font-weight: var(--lcl-font-weight-semibold);\n}\n\n""",
    '',
    'old rule info label layout',
)
theme_path.write_text(text)

# Guard the product UI: contextual info must come through InfoLabel or Modal.titleInfo.
ux_path = Path('scripts/quality/ux-gate.mjs')
text = ux_path.read_text()
needle = """    if (source.includes('IconInfoCircle')) {\n      addFailure(\n        path,\n        'contextual mobile info must use the shared @lcl/ui InfoPopover instead of ad-hoc IconInfoCircle buttons'\n      );\n    }\n"""
replacement = """    if (source.includes('IconInfoCircle')) {\n      addFailure(\n        path,\n        'contextual mobile info must use shared InfoLabel or Modal.titleInfo instead of ad-hoc IconInfoCircle buttons'\n      );\n    }\n    if (source.includes('<InfoPopover')) {\n      addFailure(\n        path,\n        'mobile product screens must not place InfoPopover directly; use InfoLabel beside labels or Modal.titleInfo beside modal titles'\n      );\n    }\n"""
text = replace_once(text, needle, replacement, 'contextual info UX gate')
ux_path.write_text(text)

# Tests enforce label adjacency, modal title placement and viewport clamping.
test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = test_path.read_text()
text = replace_once(
    text,
    "expect(tooltipButton.closest('.lcl-modal__header-actions')).not.toBeNull();",
    "expect(tooltipButton.closest('.lcl-modal__title-row')).not.toBeNull();",
    'network scan info title placement assertion',
)
text = replace_once(
    text,
    """      expect(\n        within(ruleModeField as HTMLElement).getByRole('button', {\n          name: 'Podsumowanie reguły'\n        })\n      ).toBeInTheDocument();\n      const vpdSection = screen\n""",
    """      const ruleModeInfoLabel = within(ruleModeField as HTMLElement)\n        .getByText('Tryb reguły')\n        .closest('.lcl-info-label');\n      expect(ruleModeInfoLabel).not.toBeNull();\n      expect(\n        within(ruleModeInfoLabel as HTMLElement).getByRole('button', {\n          name: 'Podsumowanie reguły'\n        })\n      ).toBeInTheDocument();\n      const vpdSection = screen\n""",
    'Rule mode shared InfoLabel assertion',
)
text = replace_once(
    text,
    """      expect(vpdSection).not.toBeNull();\n      const vpdInfoButton = within(vpdSection as HTMLElement).getByRole('button', {\n        name: /Opcjonalnie koryguje punkt pracy/\n      });\n""",
    """      expect(vpdSection).not.toBeNull();\n      const vpdInfoLabel = screen\n        .getByText('VPD assist', { selector: 'strong' })\n        .closest('.lcl-info-label');\n      expect(vpdInfoLabel).not.toBeNull();\n      const vpdInfoButton = within(vpdInfoLabel as HTMLElement).getByRole('button', {\n        name: /Opcjonalnie koryguje punkt pracy/\n      });\n""",
    'VPD shared InfoLabel assertion',
)
text = replace_once(
    text,
    """    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'false');\n    fireEvent.click(bleInfoButton);\n""",
    """    expect(bleInfoButton.closest('.lcl-modal__title-row')).not.toBeNull();\n    expect(bleInfoButton).toHaveAttribute('aria-expanded', 'false');\n    fireEvent.click(bleInfoButton);\n""",
    'BLE modal info title placement assertion',
)

insert_after = """    expect(screen.getByRole('dialog', { name: 'Dodaj gniazdko' })).toBe(dialog);\n  });\n\n"""
viewport_test = """  it('keeps shared info popovers inside a narrow phone viewport', async () => {\n    const originalInnerWidth = window.innerWidth;\n    const originalInnerHeight = window.innerHeight;\n    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;\n    const rect = (left: number, top: number, width: number, height: number) =>\n      ({\n        x: left,\n        y: top,\n        left,\n        top,\n        right: left + width,\n        bottom: top + height,\n        width,\n        height,\n        toJSON: () => ({})\n      }) as DOMRect;\n\n    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });\n    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });\n    const rectSpy = vi\n      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')\n      .mockImplementation(function () {\n        if (this.classList.contains('lcl-info-popover__trigger')) {\n          return rect(4, 700, 40, 40);\n        }\n        if (this.classList.contains('lcl-info-popover__bubble')) {\n          return rect(0, 0, 352, 180);\n        }\n        return originalGetBoundingClientRect.call(this);\n      });\n\n    try {\n      renderHardwareSetup();\n      const dialog = await openShellyAddDialog('scan');\n      const infoButton = within(dialog).getByRole('button', {\n        name: 'Informacja o skanowaniu Shelly'\n      });\n      fireEvent.click(infoButton);\n      const popover = within(dialog).getByRole('tooltip', { name: 'Skanowanie Shelly' });\n\n      await waitFor(() => {\n        const left = Number.parseFloat(popover.style.left);\n        const top = Number.parseFloat(popover.style.top);\n        expect(left).toBeGreaterThanOrEqual(16);\n        expect(left + 352).toBeLessThanOrEqual(374);\n        expect(top).toBeGreaterThanOrEqual(16);\n        expect(top + 180).toBeLessThanOrEqual(828);\n      });\n    } finally {\n      rectSpy.mockRestore();\n      Object.defineProperty(window, 'innerWidth', {\n        configurable: true,\n        value: originalInnerWidth\n      });\n      Object.defineProperty(window, 'innerHeight', {\n        configurable: true,\n        value: originalInnerHeight\n      });\n    }\n  });\n\n"""
if text.count(insert_after) < 1:
    raise SystemExit('network scan test insertion point missing')
text = text.replace(insert_after, insert_after + viewport_test, 1)
test_path.write_text(text)

# Final structural guards before expensive checks.
production_tsx = [
    path
    for path in Path('apps/mobile/src').rglob('*.tsx')
    if '__tests__' not in path.parts and not path.name.endswith(('.test.tsx', '.spec.tsx'))
]
for path in production_tsx:
    source = path.read_text()
    if '<InfoPopover' in source:
        raise SystemExit(f'direct InfoPopover remains in product screen: {path}')
    if 'IconInfoCircle' in source:
        raise SystemExit(f'ad-hoc info icon remains in product screen: {path}')

rule_source = rule_path.read_text()
if rule_source.count('<InfoLabel') != 2:
    raise SystemExit(f'expected two RuleSetup InfoLabel usages, found {rule_source.count("<InfoLabel")}')
if shelly_path.read_text().count('titleInfo={{') < 1:
    raise SystemExit('Shelly network scan titleInfo missing')
if ble_path.read_text().count('titleInfo={{') != 1:
    raise SystemExit('Shelly BLE titleInfo missing')

print('Standardized contextual info placement and clamped shared popovers to the viewport')
