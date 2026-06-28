import { useEffect } from 'react';
import type { StatusTone } from './StatusBadge.js';

export type ToastTone = Exclude<StatusTone, 'inactive'>;

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
}

export interface ToastViewportProps {
  toasts: readonly ToastMessage[];
  autoDismissMs?: number;
  dismissLabel?: string;
  onDismiss(id: string): void;
}

export const ToastViewport = ({
  toasts,
  autoDismissMs = 5000,
  dismissLabel = 'Zamknij',
  onDismiss
}: ToastViewportProps) => {
  useEffect(() => {
    if (autoDismissMs <= 0 || toasts.length === 0) {
      return undefined;
    }

    const timeoutIds = toasts.map((toast) =>
      window.setTimeout(() => onDismiss(toast.id), autoDismissMs)
    );

    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }, [autoDismissMs, onDismiss, toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Powiadomienia"
      aria-live="polite"
      className="lcl-toast-viewport"
      role="region"
    >
      {toasts.map((toast) => (
        <section
          key={toast.id}
          className={`lcl-toast lcl-toast--${toast.tone}`}
          role={toast.tone === 'danger' ? 'alert' : 'status'}
        >
          <div>
            <strong>{toast.title}</strong>
            {toast.detail && <p>{toast.detail}</p>}
          </div>
          <button
            aria-label={`${dismissLabel}: ${toast.title}`}
            className="lcl-toast__dismiss"
            type="button"
            onClick={() => onDismiss(toast.id)}
          >
            x
          </button>
        </section>
      ))}
    </div>
  );
};
