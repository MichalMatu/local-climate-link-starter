import type { Locale } from '../i18n.js';

type DeviceLedCopy = {
  title: string;
  description: string;
  currentMode: string;
  power: string;
  switch: string;
  off: string;
  onState: string;
  offState: string;
  customColor: string;
  color: string;
  brightness: string;
  powerBrightness: string;
  nightMode: string;
  nightModeEnabled: string;
  nightBrightness: string;
  nightStart: string;
  nightEnd: string;
  save: string;
  saving: string;
  noChanges: string;
  saved: string;
  loading: string;
  unsupported: string;
  unavailable: string;
  actionFailed: string;
};

const en: DeviceLedCopy = {
  title: 'Plug LED',
  description: 'This setting belongs to Shelly and does not change automation logic.',
  currentMode: 'LED mode',
  power: 'Power usage',
  switch: 'Show ON/OFF',
  off: 'Off',
  onState: 'ON',
  offState: 'OFF',
  customColor: 'Use custom color',
  color: 'Color',
  brightness: 'Brightness',
  powerBrightness: 'Power mode brightness',
  nightMode: 'Night mode',
  nightModeEnabled: 'Enable night mode',
  nightBrightness: 'Night brightness',
  nightStart: 'Starts at',
  nightEnd: 'Ends at',
  save: 'Save LED settings',
  saving: 'Saving…',
  noChanges: 'No LED changes to save.',
  saved: 'LED settings saved.',
  loading: 'Reading LED settings…',
  unsupported:
    'This device or firmware does not expose PLUGS_UI settings. Other features continue to work normally.',
  unavailable: 'Could not read LED settings from Shelly.',
  actionFailed: 'Could not change LED settings.'
};

export const deviceLedCopy: Record<Locale, DeviceLedCopy> = {
  en,
  pl: {
    ...en,
    title: 'LED gniazdka',
    description: 'To ustawienie należy do Shelly i nie zmienia logiki automatyki.',
    currentMode: 'Tryb LED',
    power: 'Zużycie energii',
    switch: 'Sygnalizuj ON/OFF',
    off: 'Wyłączona',
    onState: 'ON',
    offState: 'OFF',
    customColor: 'Użyj własnego koloru',
    color: 'Kolor',
    brightness: 'Jasność',
    powerBrightness: 'Jasność trybu mocy',
    nightMode: 'Tryb nocny',
    nightModeEnabled: 'Włącz tryb nocny',
    nightBrightness: 'Jasność nocna',
    nightStart: 'Początek',
    nightEnd: 'Koniec',
    save: 'Zapisz ustawienia LED',
    saving: 'Zapisuję…',
    noChanges: 'Brak zmian LED do zapisania.',
    saved: 'Ustawienia LED zapisane.',
    loading: 'Odczytuję ustawienia LED…',
    unsupported:
      'To urządzenie lub firmware nie udostępnia ustawień PLUGS_UI. Pozostałe funkcje działają normalnie.',
    unavailable: 'Nie udało się odczytać ustawień LED z Shelly.',
    actionFailed: 'Nie udało się zmienić ustawień LED.'
  },
  de: {
    ...en,
    title: 'Steckdosen-LED',
    currentMode: 'LED-Modus',
    power: 'Leistungsverbrauch',
    switch: 'ON/OFF anzeigen',
    off: 'Aus'
  },
  es: {
    ...en,
    title: 'LED del enchufe',
    currentMode: 'Modo LED',
    power: 'Consumo de energía',
    switch: 'Mostrar ON/OFF',
    off: 'Apagado'
  },
  fr: {
    ...en,
    title: 'LED de la prise',
    currentMode: 'Mode LED',
    power: 'Consommation électrique',
    switch: 'Afficher ON/OFF',
    off: 'Éteinte'
  },
  it: {
    ...en,
    title: 'LED della presa',
    currentMode: 'Modalità LED',
    power: 'Consumo energetico',
    switch: 'Mostra ON/OFF',
    off: 'Spento'
  },
  'pt-BR': {
    ...en,
    title: 'LED da tomada',
    currentMode: 'Modo do LED',
    power: 'Consumo de energia',
    switch: 'Mostrar ON/OFF',
    off: 'Desligado'
  }
};
