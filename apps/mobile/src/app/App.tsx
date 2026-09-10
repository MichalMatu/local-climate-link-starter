import { Capacitor } from '@capacitor/core';
import { IconSettings } from '@tabler/icons-react';
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
          <IconSettings className="app-settings-trigger__icon" aria-hidden="true" />
        </button>
        <AppRoutes onOpenSettings={() => setSettingsOpen(true)} />
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
