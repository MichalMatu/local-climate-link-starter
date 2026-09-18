import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

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
