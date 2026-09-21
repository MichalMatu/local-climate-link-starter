import type { Locale } from '../i18n.js';

type DeviceCloudCopy = {
  eyebrow: string;
  title: string;
  description: string;
  enable: string;
  enabledHint: string;
  disabledHint: string;
  connection: string;
  connected: string;
  disconnected: string;
  save: string;
  saving: string;
  noChanges: string;
  saved: string;
  loading: string;
  unsupported: string;
  unavailable: string;
  actionFailed: string;
};

const en: DeviceCloudCopy = {
  eyebrow: 'Device settings',
  title: 'Shelly Cloud',
  description:
    'Choose whether this Plug can connect to Shelly Cloud. Local Climate Link does not require it.',
  enable: 'Enable Shelly Cloud',
  enabledHint:
    'The Plug may connect to Shelly Cloud while local control remains available.',
  disabledHint:
    'Shelly Cloud is off. Local Climate Link continues to work over the local network.',
  connection: 'Cloud connection',
  connected: 'Connected',
  disconnected: 'Not connected',
  save: 'Save cloud setting',
  saving: 'Saving…',
  noChanges: 'No cloud setting changes to save.',
  saved: 'Cloud setting saved.',
  loading: 'Reading Shelly Cloud setting…',
  unsupported: 'This device or firmware does not expose Shelly Cloud configuration.',
  unavailable: 'Could not read the Shelly Cloud setting.',
  actionFailed: 'Could not change the Shelly Cloud setting.'
};

export const deviceCloudCopy: Record<Locale, DeviceCloudCopy> = {
  en,
  pl: {
    ...en,
    eyebrow: 'Ustawienia urządzenia',
    description:
      'Wybierz, czy gniazdko może łączyć się z chmurą Shelly. Local Climate Link jej nie wymaga.',
    enable: 'Włącz Shelly Cloud',
    enabledHint:
      'Gniazdko może łączyć się z chmurą Shelly; sterowanie lokalne nadal działa.',
    disabledHint:
      'Shelly Cloud jest wyłączona. Local Climate Link nadal działa w sieci lokalnej.',
    connection: 'Połączenie z chmurą',
    connected: 'Połączono',
    disconnected: 'Brak połączenia',
    save: 'Zapisz ustawienie chmury',
    saving: 'Zapisuję…',
    noChanges: 'Brak zmian ustawienia chmury do zapisania.',
    saved: 'Ustawienie chmury zapisane.',
    loading: 'Odczytuję ustawienie Shelly Cloud…',
    unsupported: 'To urządzenie lub firmware nie udostępnia konfiguracji Shelly Cloud.',
    unavailable: 'Nie udało się odczytać ustawienia Shelly Cloud.',
    actionFailed: 'Nie udało się zmienić ustawienia Shelly Cloud.'
  },
  de: { ...en, eyebrow: 'Geräteeinstellungen', enable: 'Shelly Cloud aktivieren' },
  es: { ...en, eyebrow: 'Ajustes del dispositivo', enable: 'Activar Shelly Cloud' },
  fr: { ...en, eyebrow: 'Réglages de l’appareil', enable: 'Activer Shelly Cloud' },
  it: { ...en, eyebrow: 'Impostazioni dispositivo', enable: 'Abilita Shelly Cloud' },
  'pt-BR': {
    ...en,
    eyebrow: 'Configurações do dispositivo',
    enable: 'Ativar Shelly Cloud'
  }
};
