import { useCallback, useRef, useState } from 'react';
import type { ToastMessage, ToastTone } from '@lcl/ui';

export const useToastQueue = (idPrefix: string) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissToastsWhere = useCallback(
    (predicate: (toast: ToastMessage) => boolean) => {
      setToasts((current) => current.filter((toast) => !predicate(toast)));
    },
    []
  );

  const pushToast = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      toastIdRef.current += 1;
      const id = `${idPrefix}-${toastIdRef.current}`;
      const toast: ToastMessage =
        detail === undefined ? { id, tone, title } : { id, tone, title, detail };
      setToasts((current) => [...current.slice(-2), toast]);
    },
    [idPrefix]
  );

  return { dismissToast, dismissToastsWhere, pushToast, toasts };
};
