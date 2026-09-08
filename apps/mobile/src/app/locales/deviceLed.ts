import type { Locale } from '../i18n.js';

type DeviceLedCopy = {
  eyebrow: string;
  title: string;
  description: string;
  currentMode: string;
  power: string;
  switch: string;
  off: string;
  onState: string;
  offState: string;
  powerBrightness: string;
  relayPreset: string;
  relayPresetHint: string;
  turnOff: string;
  loading: string;
  unsupported: string;
  unavailable: string;
  relayPresetSuccess: string;
  offSuccess: string;
  actionFailed: string;
};

const en: DeviceLedCopy = {
  eyebrow: 'Device settings',
  title: 'Plug LED',
  description: 'This setting belongs to Shelly and does not change automation logic.',
  currentMode: 'LED mode',
  power: 'Power usage',
  switch: 'Relay state',
  off: 'Off',
  onState: 'ON',
  offState: 'OFF',
  powerBrightness: 'Power mode brightness',
  relayPreset: 'Show ON/OFF',
  relayPresetHint: 'Preset: ON green, OFF red, 100% brightness.',
  turnOff: 'Turn LED off',
  loading: 'Reading LED settings…',
  unsupported:
    'This device or firmware does not expose PLUGS_UI settings. Other features continue to work normally.',
  unavailable: 'Could not read LED settings from Shelly.',
  relayPresetSuccess: 'The LED now shows the relay state.',
  offSuccess: 'The LED has been turned off.',
  actionFailed: 'Could not change LED settings.'
};

export const deviceLedCopy: Record<Locale, DeviceLedCopy> = {
  en,
  pl: {
    eyebrow: 'Ustawienia urządzenia',
    title: 'LED gniazdka',
    description: 'To ustawienie należy do Shelly i nie zmienia logiki automatyki.',
    currentMode: 'Tryb LED',
    power: 'Zużycie energii',
    switch: 'Stan przekaźnika',
    off: 'Wyłączona',
    onState: 'ON',
    offState: 'OFF',
    powerBrightness: 'Jasność trybu mocy',
    relayPreset: 'Sygnalizuj ON/OFF',
    relayPresetHint: 'Preset: ON zielony, OFF czerwony, jasność 100%.',
    turnOff: 'Wyłącz LED',
    loading: 'Odczytuję ustawienia LED…',
    unsupported:
      'To urządzenie lub firmware nie udostępnia ustawień PLUGS_UI. Pozostałe funkcje działają normalnie.',
    unavailable: 'Nie udało się odczytać ustawień LED z Shelly.',
    relayPresetSuccess: 'LED pokazuje teraz stan przekaźnika.',
    offSuccess: 'LED został wyłączony.',
    actionFailed: 'Nie udało się zmienić ustawień LED.'
  },
  de: {
    ...en,
    eyebrow: 'Geräteeinstellungen',
    title: 'Steckdosen-LED',
    currentMode: 'LED-Modus',
    power: 'Leistungsverbrauch',
    switch: 'Relaiszustand',
    off: 'Aus',
    relayPreset: 'ON/OFF anzeigen',
    turnOff: 'LED ausschalten'
  },
  es: {
    ...en,
    eyebrow: 'Ajustes del dispositivo',
    title: 'LED del enchufe',
    currentMode: 'Modo LED',
    power: 'Consumo de energía',
    switch: 'Estado del relé',
    off: 'Apagado',
    relayPreset: 'Mostrar ON/OFF',
    turnOff: 'Apagar LED'
  },
  fr: {
    ...en,
    eyebrow: 'Réglages de l’appareil',
    title: 'LED de la prise',
    currentMode: 'Mode LED',
    power: 'Consommation électrique',
    switch: 'État du relais',
    off: 'Éteinte',
    relayPreset: 'Afficher ON/OFF',
    turnOff: 'Éteindre la LED'
  },
  it: {
    ...en,
    eyebrow: 'Impostazioni dispositivo',
    title: 'LED della presa',
    currentMode: 'Modalità LED',
    power: 'Consumo energetico',
    switch: 'Stato relè',
    off: 'Spento',
    relayPreset: 'Mostra ON/OFF',
    turnOff: 'Spegni LED'
  },
  'pt-BR': {
    ...en,
    eyebrow: 'Configurações do dispositivo',
    title: 'LED da tomada',
    currentMode: 'Modo do LED',
    power: 'Consumo de energia',
    switch: 'Estado do relé',
    off: 'Desligado',
    relayPreset: 'Mostrar ON/OFF',
    turnOff: 'Desligar LED'
  }
};
