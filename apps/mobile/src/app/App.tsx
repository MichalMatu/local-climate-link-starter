import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { AppRoutes } from '../routes/AppRoutes.js';
import { I18nProvider } from './i18n.js';
import './appShell.css';

const DevCommandPalette = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('./DevCommandPalette.js');
      return { default: module.DevCommandPalette };
    })
  : null;

const AppContent = () => (
  <>
    <div className="app-shell">
      <AppRoutes />
    </div>

    {DevCommandPalette && (
      <Suspense fallback={null}>
        <DevCommandPalette />
      </Suspense>
    )}
  </>
);

export const App = () => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false }
        }
      })
  );

  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </I18nProvider>
  );
};