export const messages = {
  pl: {
    app: {
      name: 'Local Climate Link',
      promise: 'Termostat bez huba.',
      promiseDetail:
        'Termometr BLE + gniazdko Shelly. Konfigurujesz raz w aplikacji, działa lokalnie.'
    },
    common: {
      add: 'Dodaj',
      close: 'Zamknij',
      diagnostics: 'Diagnostyka',
      missing: 'brak',
      off: 'OFF',
      operationFailed: 'Operacja nie powiodła się.',
      refresh: 'Odśwież',
      send: 'Wyślij',
      sending: 'Wysyłam',
      test: 'Przetestuj',
      testing: 'Testuję',
      disabled: 'wyłączone',
      enabled: 'włączone',
      missingInStatus: 'brak w statusie'
    },
    demo: {
      addKit: 'Dodaj zestaw',
      emptySensors: 'Nie wybrano jeszcze czujnika.',
      install: 'Zainstaluj demo',
      loadingSensors: 'Szukam czujników demo.',
      relayFailed: 'Test przekaźnika nie powiódł się. Gniazdko zostało wyłączone.',
      uploadFailed: 'Nie udało się wysłać skryptu demo.'
    },
    hardware: {
      ready: 'Gotowe — działa lokalnie',
      nav: {
        label: 'Menu konfiguracji',
        shelly: 'Shelly',
        shellyTitle: 'Gniazdka Shelly i sterowanie',
        sensor: 'Termometry',
        sensorTitle: 'Termometry BLE',
        rule: 'Reguła',
        ruleTitle: 'Progi i wysyłka reguły do Shelly',
        diagnostics: 'Diag',
        diagnosticsTitle: 'Diagnostyka skryptu Shelly'
      },
      safety: {
        heatingDefaultOff: 'Dla grzania domyślny tryb bezpieczeństwa to OFF.',
        matterBlocked: 'Matter jest włączony. Lokalny termostat wymaga Shelly Scripts.',
        noHeater:
          'Przed testem nie podłączaj jeszcze grzejnika ani innego obciążenia 230 V.'
      },
      shelly: {
        add: 'Dodaj gniazdko',
        added: 'Dodano gniazdko.',
        checkFailedTitle: 'Nie udało się sprawdzić Shelly.',
        checkFailedDetail: 'Sprawdź IP w routerze albo w ustawieniach Shelly.',
        invalidResponse: 'Pod tym adresem nie dostałem poprawnej odpowiedzi z Shelly.',
        outOfMemory:
          'Shelly zabrakło pamięci na skaner BLE. Zamknij skaner, odczekaj chwilę i spróbuj ponownie. Jeśli problem wróci, zrestartuj Shelly.',
        scriptsMissing:
          'Nie widzę Shelly Scripts w statusie gniazdka. Sprawdź firmware albo wyłącz Matter.',
        scriptsDisabled: 'Shelly Scripts są wyłączone na tym gniazdku.',
        bleMissing:
          'Nie widzę Bluetooth/BLE w statusie Shelly. Sprawdź, czy gniazdko obsługuje BLE.',
        bleDisabled: 'Bluetooth/BLE jest wyłączony w Shelly.',
        bleScannerCleanupFailed: 'Nie udało się posprzątać skanerów BLE.',
        invalidScriptCode: 'Shelly zwróciło niepoprawny kod skryptu.',
        relayStillOn: 'Shelly nadal pokazuje przekaźnik ON.',
        deleteScriptPartial:
          'Przekaźnik OFF potwierdzony, ale nie udało się usunąć skryptu.',
        deleteScannerFailed: 'Nie udało się zatrzymać albo usunąć skryptu skanera BLE.',
        scanRangeFailed: 'Sprawdź zakres skanu.',
        scanNetworkFailedTitle: 'Nie udało się przeskanować sieci.',
        bleScannerCloseFailedTitle: 'Nie udało się zamknąć skanera BLE.',
        bleScannerStartFailedTitle: 'Nie udało się uruchomić skanera BLE.',
        copiedAddress: 'Skopiowano adres.',
        scanningIpRange: 'Skanuję zakres IP.',
        scanStopped: 'Skan zatrzymany.',
        copyAddressFailedTitle: 'Nie udało się skopiować adresu.',
        copyAddressFailedDetail: 'Kliknij adres, żeby wpisać go do formularza.',
        scanningBle: 'Skanuję termometry BLE',
        scanningBleSafeOff: 'Shelly: OFF na czas skanu.',
        removed: 'Usunięto gniazdko z aplikacji.'
      },
      sensor: {
        add: 'Dodaj termometr',
        phoneBleFailedTitle: 'Nie udało się uruchomić BLE.',
        phoneBleDisabled: 'Bluetooth jest wyłączony. Włącz Bluetooth i spróbuj ponownie.',
        phoneBleUnavailableInBrowser:
          'Skan BLE z telefonu wymaga aplikacji mobilnej. W przeglądarce nie dostanę MAC termometru.',
        phoneBleGenericFailed: 'Nie udało się uruchomić BLE w telefonie.',
        phoneBleNoRuntimeAddress:
          'Telefon wykrył termometr, ale nie udostępnił MAC. Użyj aplikacji na Androidzie albo skanu z Shelly.',
        removed: 'Usunięto termometr z aplikacji.'
      },
      rule: {
        scriptPreview: 'Podgląd Shelly Script',
        setThreshold: 'Ustaw próg',
        thresholdInvalid: 'Próg włączenia musi być niższy niż próg wyłączenia.',
        relayTestDone: 'Test zakończony. Gniazdko jest OFF.',
        copyGeneratedScriptDone: 'Skopiowano skrypt.',
        copyManagedScriptDone: 'Skopiowano skrypt z Shelly.',
        copyScriptFailedTitle: 'Nie udało się skopiować skryptu.',
        copyScriptFailedDetail:
          'Zaznacz tekst skryptu ręcznie i skopiuj go z przeglądarki.',
        readScriptFailedTitle: 'Nie udało się pobrać skryptu.',
        deleteScriptFailedTitle: 'Nie udało się usunąć skryptu.',
        deleteScriptDone: 'Usunięto skrypt Shelly.',
        relayTestFailedTitle: 'Test przekaźnika nie powiódł się.',
        installBlockedTitle: 'Nie mogę wysłać reguły',
        relayTestTitle: 'Przetestuj przekaźnik przed użyciem',
        automationScriptMissing: 'Najpierw zapisz regułę dla tego gniazdka.'
      },
      flow: {
        advancedOptionsInvalid: 'Sprawdź opcje zaawansowane.',
        bleScanCleanupFailed: 'Nie udało się posprzątać po nieudanym starcie skanu BLE.',
        bleScanStartFailed: 'Nie udało się uruchomić skanu BLE.',
        fixShellyData: 'Popraw dane gniazdka.',
        installFirst: 'Najpierw wyślij aktualną regułę.',
        noSelectedSensor: 'Dodaj i wybierz termometr.',
        noSelectedShelly: 'Wybierz gniazdko Shelly.',
        noSelectedDiagnosticShelly: 'Wybierz gniazdko Shelly do diagnostyki.',
        relayAutoStarted: 'Tryb AUTO uruchomiony.',
        relayManualOff: 'Tryb MANUAL. Przekaźnik OFF.',
        relayOff: 'Przekaźnik OFF.',
        relayOffNotConfirmed: 'Test nie potwierdził stanu OFF.',
        relayOn: 'Przekaźnik ON.',
        scriptDeleted: 'Usunięto skrypt Shelly.',
        thresholdOrderInvalid: 'Progi reguły są ustawione w niepoprawnej kolejności.',
        vpdInvalid: 'Docelowe VPD musi być liczbą większą od 0 kPa.'
      },
      diagnostics: {
        title: 'Diagnostyka',
        readFailed: 'Nie udało się odczytać diagnostyki ze skryptu Shelly.',
        scriptNotRunning:
          'Skrypt Local Climate Link nie działa w Shelly. Status: {status}.',
        scriptOutOfMemory:
          'Skrypt Local Climate Link nie działa: Shelly zgłasza out_of_memory. Wyłącz Matter w Shelly, zrestartuj gniazdko i wyślij regułę ponownie.',
        empty: 'Sprawdź, czy na wybranym gniazdku jest skrypt Local Climate Link.'
      },
      validation: {
        sensorNameRequired: 'Wpisz nazwę termometru.',
        sensorMacRequired: 'Wpisz MAC termometru.',
        sensorMacFormat: 'Wpisz poprawny MAC termometru.',
        shellyIpRequired: 'Wpisz adres IP Shelly.',
        shellyIpFormat: 'Wpisz poprawny adres IP Shelly.',
        shellyIpInvalid: 'Adres IP Shelly musi wyglądać jak 192.168.0.20.',
        shellyNameRequired: 'Wpisz nazwę gniazdka.',
        sensorMacInvalid: 'MAC termometru musi mieć 6 bajtów.',
        scanAddressRequired: 'Wpisz adres {label}, np. 192.168.0.1.',
        scanAddressInvalid: 'Adres {label} musi wyglądać jak 192.168.0.1.',
        scanAddressHostInvalid: 'Adres {label} musi kończyć się liczbą od 1 do 254.',
        scanRangeNetworkMismatch:
          'Adresy muszą być w tej samej sieci, np. 192.168.0.1 do 192.168.0.99.',
        scanRangeOrderInvalid: 'Adres początkowy musi być niższy niż końcowy.',
        scanStartLabel: 'początkowy',
        scanEndLabel: 'końcowy'
      }
    }
  }
} as const;

export type Locale = keyof typeof messages;
type MessageTree = (typeof messages)['pl'];
type MessageParams = Record<string, string | number>;

type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${LeafPaths<T[K]>}`
      : never;
}[keyof T & string];

export type TranslationKey = LeafPaths<MessageTree>;

const currentLocale: Locale = 'pl';

const resolveMessage = (key: TranslationKey): string => {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      return undefined;
    }
    return (node as Record<string, unknown>)[part];
  }, messages[currentLocale]);

  if (typeof value !== 'string') {
    throw new Error(`Missing translation key: ${key}`);
  }

  return value;
};

export const t = (key: TranslationKey, params: MessageParams = {}): string =>
  resolveMessage(key).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramName) =>
    paramName in params ? String(params[paramName]) : match
  );
