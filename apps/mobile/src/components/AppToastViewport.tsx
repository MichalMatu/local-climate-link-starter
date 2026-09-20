import { ToastViewport, type ToastViewportProps } from '@lcl/ui';
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const APP_TOAST_HOST_ID = 'app-toast-host';

export const AppToastViewport = (props: ToastViewportProps) => {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    setHost(document.getElementById(APP_TOAST_HOST_ID));
  }, []);

  return host ? createPortal(<ToastViewport {...props} />, host) : null;
};
