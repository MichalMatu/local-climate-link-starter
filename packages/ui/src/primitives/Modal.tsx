import { useEffect, useId, useRef, type ReactNode } from 'react';

type ModalInitialFocus = 'dialog' | 'first-control';

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  closeLabel: string;
  busy?: boolean;
  dismissible?: boolean;
  initialFocus?: ModalInitialFocus;
  size?: 'default' | 'diagnostic' | 'workspace';
  children: ReactNode;
  headerActions?: ReactNode;
  actions?: ReactNode;
  onClose(): void;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const focusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hasAttribute('hidden') &&
      element.getAttribute('aria-hidden') !== 'true'
  );

export const Modal = ({
  open,
  title,
  description,
  closeLabel,
  busy = false,
  dismissible = true,
  initialFocus = 'dialog',
  size = 'default',
  children,
  headerActions,
  actions,
  onClose
}: ModalProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const canDismiss = dismissible && !busy;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (canDismiss) {
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const modal = modalRef.current;
      if (!modal) {
        return;
      }

      const focusable = focusableElements(modal);
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!firstElement || !lastElement) {
        return;
      }

      if (!modal.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      const modal = modalRef.current;
      if (!modal) {
        return;
      }
      if (initialFocus === 'first-control') {
        (focusableElements(modal)[0] ?? modal).focus();
        return;
      }
      modal.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      const previouslyFocusedElement = previouslyFocusedElementRef.current;
      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
      previouslyFocusedElementRef.current = null;
    };
  }, [canDismiss, initialFocus, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={`lcl-modal-backdrop lcl-modal-backdrop--${size}`}
      role="presentation"
      onClick={canDismiss ? onClose : undefined}
    >
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`lcl-modal lcl-modal--${size}`}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="lcl-modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          {headerActions && (
            <div className="lcl-modal__header-actions">{headerActions}</div>
          )}
        </header>

        <div className="lcl-modal__body">{children}</div>

        <footer className="lcl-modal__footer">
          {actions}
          <button className="lcl-modal__close" type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </footer>
      </section>
    </div>
  );
};
