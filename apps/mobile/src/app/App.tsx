import { Capacitor } from '@capacitor/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useState } from 'react';
import { AppRoutes } from '../routes/AppRoutes.js';
import { AppSettingsModal } from './AppSettingsModal.js';
import { I18nProvider, useTranslation } from './i18n.js';
import './appShell.css';

const DevCommandPalette = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('./DevCommandPalette.js');
      return { default: module.DevCommandPalette };
    })
  : null;

const SettingsIcon = () => (
  <svg
    aria-hidden="true"
    className="app-settings-trigger__icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 3.75 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.55h.05a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.86-2.86.06.06A1.7 1.7 0 0 0 8.15 3.75a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4.05v.05a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21v4.05h-.1a1.7 1.7 0 0 0-1.1.4 1.7 1.7 0 0 0-.4 1Z" />
  </svg>
);

const AppContent = () => {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const platform = Capacitor.getPlatform();

  return (
    <>
      <div className="app-shell">
        <button
          className="app-settings-trigger"
          type="button"
          aria-label={t('settings.open')}
          title={t('settings.open')}
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsIcon />
        </button>
        <AppRoutes />
      </div>

      <AppSettingsModal
        open={settingsOpen}
        supportRows={[{ label: t('settings.support.platform'), value: platform }]}
        supportReportInput={{
          platform,
          shellyDevices: [],
          sensorDevices: [],
          selectedShelly: t('common.missing'),
          selectedSensor: t('common.missing'),
          lastDiagnostics: []
        }}
        onClose={() => setSettingsOpen(false)}
      />

      {DevCommandPalette && (
        <Suspense fallback={null}>
          <DevCommandPalette />
        </Suspense>
      )}
    </>
  );
};

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
