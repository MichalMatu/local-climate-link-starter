import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AppRoutes } from '../routes/AppRoutes.js';
import { I18nProvider } from './i18n.js';

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
        <div className="app-shell">
          <AppRoutes />
        </div>
      </QueryClientProvider>
    </I18nProvider>
  );
};
