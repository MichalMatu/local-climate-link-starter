import { ToastViewport, type ToastViewportProps } from '@lcl/ui';
import { createPortal } from 'react-dom';

export const APP_TOAST_HOST_ID = 'app-toast-host';

export const AppToastViewport = (props: ToastViewportProps) => {
  const host =
    typeof document === 'undefined' ? null : document.getElementById(APP_TOAST_HOST_ID);
  const viewport = <ToastViewport {...props} />;

  return host ? createPortal(viewport, host) : viewport;
};
