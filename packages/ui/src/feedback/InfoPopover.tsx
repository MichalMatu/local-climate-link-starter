import {
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
  title?: string | undefined;
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
