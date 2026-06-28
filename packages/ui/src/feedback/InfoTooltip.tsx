import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface InfoTooltipProps {
  label: string;
  title?: string;
  children: ReactNode;
}

export const InfoTooltip = ({ label, title, children }: InfoTooltipProps) => {
  const tooltipId = useId();
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isHoverSuppressed, setIsHoverSuppressed] = useState(false);

  const toggleTooltip = () => {
    setIsHoverSuppressed(isOpen);
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && tooltipRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
      setIsHoverSuppressed(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsHoverSuppressed(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <span
      className={[
        'lcl-info-tooltip',
        isOpen ? 'lcl-info-tooltip--open' : null,
        isHoverSuppressed ? 'lcl-info-tooltip--suppress-hover' : null
      ]
        .filter(Boolean)
        .join(' ')}
      ref={tooltipRef}
      onMouseLeave={() => setIsHoverSuppressed(false)}
    >
      <button
        aria-controls={tooltipId}
        aria-describedby={tooltipId}
        aria-expanded={isOpen}
        aria-label={label}
        className="lcl-info-tooltip__trigger"
        type="button"
        onClick={toggleTooltip}
      >
        i
      </button>
      <span className="lcl-info-tooltip__bubble" id={tooltipId} role="tooltip">
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </span>
    </span>
  );
};
