import type { Locale } from '../i18n.js';

type DeviceButtonModeCopy = {
  eyebrow: string;
  title: string;
  description: string;
  currentMode: string;
  momentary: string;
  detached: string;
  momentaryHint: string;
  detachedHint: string;
  save: string;
  saving: string;
  noChanges: string;
  saved: string;
  loading: string;
  unsupported: string;
  unavailable: string;
  actionFailed: string;
};

const en: DeviceButtonModeCopy = {
  eyebrow: 'Device settings',
  title: 'Physical button',
  description: 'Choose whether the Plug button controls the relay directly.',
  currentMode: 'Button mode',
  momentary: 'Controls relay',
  detached: 'Detached from relay',
  momentaryHint: 'The physical button switches the relay on and off.',
  detachedHint: 'The physical button no longer changes the relay state.',
  save: 'Save button mode',
  saving: 'Saving…',
  noChanges: 'No button mode changes to save.',
  saved: 'Button mode saved.',
  loading: 'Reading button mode…',
  unsupported:
    'This device or firmware does not expose the Plug button mode. Other features continue to work normally.',
  unavailable: 'Could not read the button mode from Shelly.',
  actionFailed: 'Could not change the button mode.'
};

export const deviceButtonModeCopy: Record<Locale, DeviceButtonModeCopy> = {
  en,
  pl: {
    ...en,
    eyebrow: 'Ustawienia urządzenia',
    title: 'Przycisk gniazdka',
    description: 'Wybierz, czy fizyczny przycisk gniazdka steruje przekaźnikiem.',
    currentMode: 'Tryb przycisku',
    momentary: 'Steruje przekaźnikiem',
    detached: 'Odłączony od przekaźnika',
    momentaryHint: 'Fizyczny przycisk przełącza przekaźnik ON/OFF.',
    detachedHint: 'Fizyczny przycisk nie zmienia stanu przekaźnika.',
    save: 'Zapisz tryb przycisku',
    saving: 'Zapisuję…',
    noChanges: 'Brak zmian trybu przycisku do zapisania.',
    saved: 'Tryb przycisku zapisany.',
    loading: 'Odczytuję tryb przycisku…',
    unsupported:
      'To urządzenie lub firmware nie udostępnia trybu przycisku gniazdka. Pozostałe funkcje działają normalnie.',
    unavailable: 'Nie udało się odczytać trybu przycisku z Shelly.',
    actionFailed: 'Nie udało się zmienić trybu przycisku.'
  },
  de: {
    ...en,
    eyebrow: 'Geräteeinstellungen',
    title: 'Physische Taste',
    currentMode: 'Tastenmodus',
    momentary: 'Steuert Relais',
    detached: 'Vom Relais getrennt'
  },
  es: {
    ...en,
    eyebrow: 'Ajustes del dispositivo',
    title: 'Botón físico',
    currentMode: 'Modo del botón',
    momentary: 'Controla el relé',
    detached: 'Desacoplado del relé'
  },
  fr: {
    ...en,
    eyebrow: 'Réglages de l’appareil',
    title: 'Bouton physique',
    currentMode: 'Mode du bouton',
    momentary: 'Commande le relais',
    detached: 'Détaché du relais'
  },
  it: {
    ...en,
    eyebrow: 'Impostazioni dispositivo',
    title: 'Pulsante fisico',
    currentMode: 'Modalità pulsante',
    momentary: 'Controlla il relè',
    detached: 'Scollegato dal relè'
  },
  'pt-BR': {
    ...en,
    eyebrow: 'Configurações do dispositivo',
    title: 'Botão físico',
    currentMode: 'Modo do botão',
    momentary: 'Controla o relé',
    detached: 'Desacoplado do relé'
  }
};
