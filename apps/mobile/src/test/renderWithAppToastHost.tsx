import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { APP_TOAST_HOST_ID } from '../components/AppToastViewport.js';

export const renderWithAppToastHost = (ui: ReactElement, options?: RenderOptions) =>
  render(
    <>
      <div id={APP_TOAST_HOST_ID} />
      {ui}
    </>,
    options
  );
