import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { LandingPage } from './page';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>
);
