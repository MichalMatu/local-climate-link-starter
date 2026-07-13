export const landingLocales = ['pl', 'en', 'de', 'es', 'fr', 'it', 'pt-BR'] as const;

export type LandingLocale = (typeof landingLocales)[number];

type LandingMessages = {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    howItWorks: string;
    hardware: string;
    safety: string;
    sectionsAria: string;
  };
  common: {
    brand: string;
    betaCta: string;
    androidBetaCta: string;
    compatibilityCta: string;
  };
  hero: {
    title: string;
    body: string;
    actionsAria: string;
  };
  workflow: {
    title: string;
    body: string;
    steps: readonly {
      title: string;
      text: string;
    }[];
  };
  hardware: {
    title: string;
    body: string;
    items: readonly {
      name: string;
      role: string;
      detail: string;
      href: string;
    }[];
  };
  safety: {
    title: string;
    body: string;
    safeguards: readonly string[];
  };
  preview: {
    aria: string;
    tabs: {
      shelly: string;
      sensors: string;
      rule: string;
      diag: string;
    };
    addThermometer: string;
    sensorName: string;
  };
  instructions: {
    title: string;
    body: string;
    items: readonly string[];
  };
  beta: {
    title: string;
    body: string;
    joinCta: string;
  };
  faq: {
    title: string;
    items: readonly {
      question: string;
      answer: string;
    }[];
  };
  footer: {
    tagline: string;
    privacy: string;
  };
};

const hardwareItems = [
  {
    name: 'Shelly Plug S Gen3',
    role: 'local relay and runtime controller',
    detail: 'The script runs on stock Shelly firmware without Home Assistant or MQTT.',
    href: 'https://www.shelly.com/products/shelly-plug-s-gen3-1'
  },
  {
    name: 'Xiaomi LYWSD03MMC / PVVX',
    role: 'BLE thermometer with BTHome v2',
    detail: 'The primary MVP profile: a lightweight BLE beacon and Shelly-side parser.',
    href: 'https://github.com/pvvx/ATC_MiThermometer'
  },
  {
    name: 'TP357 custom BLE',
    role: 'second supported sensor',
    detail: 'A dedicated profile and parser for users with a TP357 custom beacon.',
    href: 'https://github.com/atc1441/ATC_MiThermometer'
  }
] as const satisfies LandingMessages['hardware']['items'];

const pl: LandingMessages = {
  meta: {
    title: 'Local Climate Link — termostat bez huba',
    description:
      'Local Climate Link konfiguruje lokalny termostat BLE + Shelly bez huba, chmury, MQTT i pracy telefonu w tle.'
  },
  nav: {
    howItWorks: 'Jak działa',
    hardware: 'Sprzęt',
    safety: 'Bezpieczeństwo',
    sectionsAria: 'Sekcje strony'
  },
  common: {
    brand: 'Local Climate Link',
    betaCta: 'Pobierz betę',
    androidBetaCta: 'Pobierz betę Android',
    compatibilityCta: 'Zobacz kompatybilność'
  },
  hero: {
    title: 'Termostat bez huba',
    body: 'Termometr BLE + gniazdko Shelly. Konfigurujesz raz w aplikacji, działa lokalnie bez chmury, MQTT i telefonu w tle.',
    actionsAria: 'Główne akcje'
  },
  workflow: {
    title: 'Lokalna automatyzacja w trzech krokach',
    body: 'Aplikacja nie steruje klimatem w tle. Ona przygotowuje Shelly do samodzielnej pracy.',
    steps: [
      {
        title: 'Aplikacja znajduje sprzęt',
        text: 'Skanujesz termometr BLE i sprawdzasz Shelly po lokalnym adresie IP.'
      },
      {
        title: 'Ustawiasz regułę',
        text: 'Wybierasz grzanie, chłodzenie, nawilżanie, osuszanie albo VPD w znanym zakresie wilgotności.'
      },
      {
        title: 'Shelly pracuje sam',
        text: 'Aplikacja wgrywa skrypt. Telefon może zniknąć z sieci, a automatyzacja działa lokalnie.'
      }
    ]
  },
  hardware: {
    title: 'Wąska lista sprzętu, mniej zgadywania',
    body: 'MVP celowo wspiera mało urządzeń. Dzięki temu reguły, parser BLE i diagnostyka są testowane na konkretnym zestawie.',
    items: [
      {
        ...hardwareItems[0],
        role: 'lokalny przekaźnik i kontroler runtime',
        detail: 'Skrypt działa na stock firmware Shelly, bez Home Assistant i bez MQTT.'
      },
      {
        ...hardwareItems[1],
        role: 'termometr BLE z BTHome v2',
        detail:
          'Najlepszy profil MVP: lekki beacon BLE i stabilny parser po stronie Shelly.'
      },
      {
        ...hardwareItems[2],
        role: 'drugi wspierany czujnik',
        detail: 'Osobny profil i parser dla użytkowników z gotowym beaconem TP357.'
      }
    ]
  },
  safety: {
    title: 'Projektowany pod realne gniazdko, nie demo w chmurze',
    body: 'Domyślny kierunek bezpieczeństwa to OFF. To ważne przy grzałkach, nawilżaczach i testach z prawdziwym obciążeniem.',
    safeguards: [
      'Start i awaria czujnika ustawiają przekaźnik w OFF.',
      'Minimalny czas zmiany chroni przed szybkim pstrykaniem gniazdkiem.',
      'Diagnostyka pokazuje ostatni odczyt, RSSI, firmware Shelly i powód decyzji.'
    ]
  },
  preview: {
    aria: 'Podgląd aplikacji Local Climate Link',
    tabs: {
      shelly: 'Shelly',
      sensors: 'Termometry',
      rule: 'Reguła',
      diag: 'Diag'
    },
    addThermometer: 'Dodaj termometr',
    sensorName: 'Salon'
  },
  instructions: {
    title: 'Instrukcja startu',
    body: 'Pierwsza wersja strony ma prowadzić do bety Android i testów sprzętu, zanim produkt trafi do sklepów.',
    items: [
      'Wgraj PVVX/BTHome v2 albo użyj wspieranego TP357.',
      'Dodaj Shelly Plug S Gen3 z wyłączonym Matter dla Shelly Scripts.',
      'Ustaw regułę i wykonaj bezpieczny test przekaźnika.',
      'Podłącz docelowe urządzenie dopiero po poprawnym teście.'
    ]
  },
  beta: {
    title: 'Beta Android do pobrania',
    body: 'Pobierz podpisany APK z GitHub Releases. Oficjalne sklepy dołączą, gdy zamkniemy checklistę release candidate.',
    joinCta: 'Pobierz APK'
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        question: 'Czy telefon musi działać cały czas?',
        answer:
          'Nie. Telefon jest tylko konfiguratoriem. Po wgraniu reguły lokalny skrypt działa na Shelly.'
      },
      {
        question: 'Czy potrzebuję chmury albo Home Assistant?',
        answer:
          'Nie w domyślnym scenariuszu. Local Climate Link celowo omija huby, MQTT i serwer 24/7.'
      },
      {
        question: 'Czy to jest gotowe dla każdego sprzętu BLE?',
        answer:
          'Nie. MVP celowo wspiera wąską ścieżkę: Xiaomi/PVVX BTHome v2, TP357 i Shelly Plug S Gen3.'
      }
    ]
  },
  footer: {
    tagline: 'Local Climate Link — lokalny klimat bez huba.',
    privacy: 'Prywatność'
  }
};

const en: LandingMessages = {
  ...pl,
  meta: {
    title: 'Local Climate Link — thermostat without a hub',
    description:
      'Local Climate Link configures a local BLE + Shelly thermostat without a hub, cloud, MQTT, or a phone running in the background.'
  },
  nav: {
    howItWorks: 'How it works',
    hardware: 'Hardware',
    safety: 'Safety',
    sectionsAria: 'Page sections'
  },
  common: {
    brand: 'Local Climate Link',
    betaCta: 'Get beta',
    androidBetaCta: 'Get Android beta',
    compatibilityCta: 'See compatibility'
  },
  hero: {
    title: 'Thermostat without a hub',
    body: 'A BLE thermometer plus a Shelly smart plug. Configure it once in the app, then it runs locally without cloud, MQTT, or a phone in the background.',
    actionsAria: 'Primary actions'
  },
  workflow: {
    title: 'Local automation in three steps',
    body: 'The app does not control climate in the background. It prepares Shelly to work on its own.',
    steps: [
      {
        title: 'The app finds hardware',
        text: 'Scan the BLE thermometer and check Shelly on its local IP address.'
      },
      {
        title: 'You set the rule',
        text: 'Choose heating, cooling, humidifying, dehumidifying, or VPD inside a known humidity range.'
      },
      {
        title: 'Shelly runs alone',
        text: 'The app uploads the script. The phone can leave the network while automation stays local.'
      }
    ]
  },
  hardware: {
    title: 'A narrow hardware list, less guessing',
    body: 'The MVP intentionally supports few devices. That keeps rules, BLE parsing, and diagnostics tested on a concrete set.',
    items: hardwareItems
  },
  safety: {
    title: 'Designed for a real plug, not a cloud demo',
    body: 'The default safety direction is OFF. That matters for heaters, humidifiers, and real-load tests.',
    safeguards: [
      'Startup and sensor failure set the relay to OFF.',
      'Minimum change time prevents rapid plug chatter.',
      'Diagnostics show the last reading, RSSI, Shelly firmware, and decision reason.'
    ]
  },
  preview: {
    aria: 'Local Climate Link app preview',
    tabs: {
      shelly: 'Shelly',
      sensors: 'Sensors',
      rule: 'Rule',
      diag: 'Diag'
    },
    addThermometer: 'Add thermometer',
    sensorName: 'Living room'
  },
  instructions: {
    title: 'Getting started',
    body: 'This first public page points to the Android beta and hardware testing before the product reaches app stores.',
    items: [
      'Flash PVVX/BTHome v2 or use a supported TP357.',
      'Add Shelly Plug S Gen3 with Matter disabled for Shelly Scripts.',
      'Set the rule and run the safe relay test.',
      'Connect the target device only after the test passes.'
    ]
  },
  beta: {
    title: 'Android beta download',
    body: 'Download the signed APK from GitHub Releases. Official stores come after the release-candidate checklist is closed.',
    joinCta: 'Download APK'
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        question: 'Does the phone have to run all the time?',
        answer:
          'No. The phone is only the configurator. After upload, the local script runs on Shelly.'
      },
      {
        question: 'Do I need cloud or Home Assistant?',
        answer:
          'No by default. Local Climate Link intentionally avoids hubs, MQTT, and a 24/7 server.'
      },
      {
        question: 'Is every BLE device supported?',
        answer:
          'No. The MVP intentionally supports a narrow path: Xiaomi/PVVX BTHome v2, TP357, and Shelly Plug S Gen3.'
      }
    ]
  },
  footer: {
    tagline: 'Local Climate Link — local climate without a hub.',
    privacy: 'Privacy'
  }
};

const de: LandingMessages = {
  ...en,
  meta: {
    title: 'Local Climate Link — Thermostat ohne Hub',
    description:
      'Local Climate Link konfiguriert einen lokalen BLE + Shelly Thermostat ohne Hub, Cloud, MQTT oder dauerhaft laufendes Smartphone.'
  },
  nav: {
    howItWorks: 'So funktioniert es',
    hardware: 'Hardware',
    safety: 'Sicherheit',
    sectionsAria: 'Seitenbereiche'
  },
  common: {
    brand: 'Local Climate Link',
    betaCta: 'Beta laden',
    androidBetaCta: 'Android-Beta laden',
    compatibilityCta: 'Kompatibilität ansehen'
  },
  hero: {
    title: 'Thermostat ohne Hub',
    body: 'Ein BLE-Thermometer plus Shelly-Steckdose. Einmal in der App konfigurieren, danach läuft alles lokal ohne Cloud, MQTT oder Smartphone im Hintergrund.',
    actionsAria: 'Hauptaktionen'
  },
  workflow: {
    title: 'Lokale Automatisierung in drei Schritten',
    body: 'Die App steuert das Klima nicht im Hintergrund. Sie bereitet Shelly für den eigenständigen Betrieb vor.',
    steps: [
      {
        title: 'Die App findet die Hardware',
        text: 'Scanne das BLE-Thermometer und prüfe Shelly über die lokale IP-Adresse.'
      },
      {
        title: 'Du setzt die Regel',
        text: 'Wähle Heizen, Kühlen, Befeuchten, Entfeuchten oder VPD innerhalb eines bekannten Feuchtebereichs.'
      },
      {
        title: 'Shelly arbeitet allein',
        text: 'Die App lädt das Skript hoch. Das Smartphone kann das Netzwerk verlassen, die Automatisierung bleibt lokal.'
      }
    ]
  },
  hardware: {
    title: 'Kurze Hardwareliste, weniger Raten',
    body: 'Das MVP unterstützt bewusst wenige Geräte. So bleiben Regeln, BLE-Parser und Diagnose auf einem konkreten Set getestet.',
    items: [
      {
        ...hardwareItems[0],
        role: 'lokales Relais und Runtime-Controller',
        detail:
          'Das Skript läuft auf der originalen Shelly-Firmware ohne Home Assistant oder MQTT.'
      },
      {
        ...hardwareItems[1],
        role: 'BLE-Thermometer mit BTHome v2',
        detail:
          'Das primäre MVP-Profil: ein leichter BLE-Beacon und Parser auf Shelly-Seite.'
      },
      {
        ...hardwareItems[2],
        role: 'zweiter unterstützter Sensor',
        detail:
          'Ein eigenes Profil und ein Parser für Nutzer mit einem TP357-Custom-Beacon.'
      }
    ]
  },
  safety: {
    title: 'Für eine echte Steckdose gebaut, nicht für eine Cloud-Demo',
    body: 'Die sichere Standardrichtung ist OFF. Das zählt bei Heizern, Luftbefeuchtern und Tests mit echter Last.',
    safeguards: [
      'Start und Sensorausfall setzen das Relais auf OFF.',
      'Eine Mindestzeit zwischen Änderungen verhindert schnelles Schalten.',
      'Die Diagnose zeigt letzten Messwert, RSSI, Shelly-Firmware und Entscheidungsgrund.'
    ]
  },
  preview: {
    aria: 'App-Vorschau von Local Climate Link',
    tabs: { shelly: 'Shelly', sensors: 'Sensoren', rule: 'Regel', diag: 'Diag' },
    addThermometer: 'Thermometer hinzufügen',
    sensorName: 'Wohnzimmer'
  },
  instructions: {
    title: 'Startanleitung',
    body: 'Diese erste öffentliche Seite führt zur Android-Beta und zu Hardwaretests, bevor das Produkt in die Stores kommt.',
    items: [
      'PVVX/BTHome v2 flashen oder einen unterstützten TP357 nutzen.',
      'Shelly Plug S Gen3 mit deaktiviertem Matter für Shelly Scripts hinzufügen.',
      'Regel setzen und den sicheren Relaistest ausführen.',
      'Das Zielgerät erst nach bestandenem Test anschließen.'
    ]
  },
  beta: {
    title: 'Android-Beta herunterladen',
    body: 'Lade die signierte APK aus GitHub Releases herunter. Offizielle Stores folgen nach der Release-Candidate-Checkliste.',
    joinCta: 'APK herunterladen'
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        question: 'Muss das Smartphone ständig laufen?',
        answer:
          'Nein. Das Smartphone ist nur der Konfigurator. Nach dem Upload läuft das lokale Skript auf Shelly.'
      },
      {
        question: 'Brauche ich Cloud oder Home Assistant?',
        answer:
          'Standardmäßig nein. Local Climate Link vermeidet bewusst Hubs, MQTT und einen Server rund um die Uhr.'
      },
      {
        question: 'Wird jedes BLE-Gerät unterstützt?',
        answer:
          'Nein. Das MVP unterstützt bewusst den engen Pfad: Xiaomi/PVVX BTHome v2, TP357 und Shelly Plug S Gen3.'
      }
    ]
  },
  footer: {
    tagline: 'Local Climate Link — lokales Klima ohne Hub.',
    privacy: 'Datenschutz'
  }
};

const es: LandingMessages = {
  ...en,
  meta: {
    title: 'Local Climate Link — termostato sin hub',
    description:
      'Local Climate Link configura un termostato local BLE + Shelly sin hub, nube, MQTT ni teléfono en segundo plano.'
  },
  nav: {
    howItWorks: 'Cómo funciona',
    hardware: 'Hardware',
    safety: 'Seguridad',
    sectionsAria: 'Secciones de la página'
  },
  common: {
    brand: 'Local Climate Link',
    betaCta: 'Descargar beta',
    androidBetaCta: 'Descargar beta Android',
    compatibilityCta: 'Ver compatibilidad'
  },
  hero: {
    title: 'Termostato sin hub',
    body: 'Un termómetro BLE más un enchufe Shelly. Lo configuras una vez en la app y funciona localmente sin nube, MQTT ni teléfono en segundo plano.',
    actionsAria: 'Acciones principales'
  },
  workflow: {
    title: 'Automatización local en tres pasos',
    body: 'La app no controla el clima en segundo plano. Prepara Shelly para trabajar por sí solo.',
    steps: [
      {
        title: 'La app encuentra el hardware',
        text: 'Escanea el termómetro BLE y comprueba Shelly por su IP local.'
      },
      {
        title: 'Configuras la regla',
        text: 'Elige calefacción, refrigeración, humidificación, deshumidificación o VPD dentro de un rango de humedad conocido.'
      },
      {
        title: 'Shelly trabaja solo',
        text: 'La app sube el script. El teléfono puede salir de la red y la automatización sigue local.'
      }
    ]
  },
  hardware: {
    title: 'Lista de hardware corta, menos dudas',
    body: 'El MVP soporta pocos dispositivos a propósito. Así las reglas, el parser BLE y el diagnóstico se prueban en un conjunto concreto.',
    items: [
      {
        ...hardwareItems[0],
        role: 'relé local y controlador en tiempo de ejecución',
        detail:
          'El script corre en el firmware Shelly original, sin Home Assistant ni MQTT.'
      },
      {
        ...hardwareItems[1],
        role: 'termómetro BLE con BTHome v2',
        detail: 'El perfil principal del MVP: un beacon BLE ligero y parser en Shelly.'
      },
      {
        ...hardwareItems[2],
        role: 'segundo sensor compatible',
        detail:
          'Perfil y parser dedicados para usuarios con un beacon TP357 personalizado.'
      }
    ]
  },
  safety: {
    title: 'Diseñado para un enchufe real, no una demo en la nube',
    body: 'La dirección segura por defecto es OFF. Importa con calefactores, humidificadores y pruebas con carga real.',
    safeguards: [
      'El arranque y el fallo del sensor ponen el relé en OFF.',
      'El tiempo mínimo entre cambios evita conmutaciones rápidas.',
      'El diagnóstico muestra última lectura, RSSI, firmware Shelly y motivo de decisión.'
    ]
  },
  preview: {
    ...en.preview,
    aria: 'Vista previa de la app Local Climate Link',
    tabs: { shelly: 'Shelly', sensors: 'Sensores', rule: 'Regla', diag: 'Diag' },
    addThermometer: 'Añadir termómetro',
    sensorName: 'Salón'
  },
  instructions: {
    title: 'Primeros pasos',
    body: 'Esta primera página pública apunta a la beta Android y a pruebas de hardware antes de llegar a las tiendas.',
    items: [
      'Flashea PVVX/BTHome v2 o usa un TP357 compatible.',
      'Añade Shelly Plug S Gen3 con Matter desactivado para Shelly Scripts.',
      'Configura la regla y ejecuta la prueba segura del relé.',
      'Conecta el dispositivo final solo después de superar la prueba.'
    ]
  },
  beta: {
    title: 'Descarga de beta Android',
    body: 'Descarga el APK firmado desde GitHub Releases. Las tiendas oficiales llegarán al cerrar la checklist de release candidate.',
    joinCta: 'Descargar APK'
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        question: '¿El teléfono debe estar siempre encendido?',
        answer:
          'No. El teléfono solo configura. Después de subir la regla, el script local corre en Shelly.'
      },
      {
        question: '¿Necesito nube o Home Assistant?',
        answer: 'No por defecto. Local Climate Link evita hubs, MQTT y servidores 24/7.'
      },
      {
        question: '¿Funciona con cualquier dispositivo BLE?',
        answer:
          'No. El MVP soporta una ruta concreta: Xiaomi/PVVX BTHome v2, TP357 y Shelly Plug S Gen3.'
      }
    ]
  },
  footer: {
    tagline: 'Local Climate Link — clima local sin hub.',
    privacy: 'Privacidad'
  }
};

const fr: LandingMessages = {
  ...en,
  meta: {
    title: 'Local Climate Link — thermostat sans hub',
    description:
      'Local Climate Link configure un thermostat local BLE + Shelly sans hub, cloud, MQTT ni téléphone en arrière-plan.'
  },
  nav: {
    howItWorks: 'Fonctionnement',
    hardware: 'Matériel',
    safety: 'Sécurité',
    sectionsAria: 'Sections de la page'
  },
  common: {
    brand: 'Local Climate Link',
    betaCta: 'Télécharger la bêta',
    androidBetaCta: 'Télécharger la bêta Android',
    compatibilityCta: 'Voir la compatibilité'
  },
  hero: {
    title: 'Thermostat sans hub',
    body: 'Un thermomètre BLE et une prise Shelly. Configure une fois dans l’app, puis tout fonctionne localement sans cloud, MQTT ni téléphone en arrière-plan.',
    actionsAria: 'Actions principales'
  },
  workflow: {
    title: 'Automatisation locale en trois étapes',
    body: 'L’app ne contrôle pas le climat en arrière-plan. Elle prépare Shelly à fonctionner seul.',
    steps: [
      {
        title: 'L’app trouve le matériel',
        text: 'Scanne le thermomètre BLE et vérifie Shelly via son adresse IP locale.'
      },
      {
        title: 'Tu règles la règle',
        text: 'Choisis chauffage, refroidissement, humidification, déshumidification ou VPD dans une plage d’humidité connue.'
      },
      {
        title: 'Shelly fonctionne seul',
        text: 'L’app téléverse le script. Le téléphone peut quitter le réseau, l’automatisation reste locale.'
      }
    ]
  },
  hardware: {
    title: 'Une liste matérielle courte, moins d’incertitude',
    body: 'Le MVP prend volontairement en charge peu d’appareils. Les règles, le parsing BLE et le diagnostic restent testés sur un ensemble concret.',
    items: [
      {
        ...hardwareItems[0],
        role: 'relais local et contrôleur runtime',
        detail:
          'Le script tourne sur le firmware Shelly d’origine, sans Home Assistant ni MQTT.'
      },
      {
        ...hardwareItems[1],
        role: 'thermomètre BLE avec BTHome v2',
        detail: 'Le profil MVP principal : un beacon BLE léger et un parser côté Shelly.'
      },
      {
        ...hardwareItems[2],
        role: 'deuxième capteur compatible',
        detail:
          'Un profil et un parser dédiés pour les utilisateurs avec un beacon TP357 personnalisé.'
      }
    ]
  },
  safety: {
    title: 'Conçu pour une vraie prise, pas une démo cloud',
    body: 'La direction de sécurité par défaut est OFF. C’est essentiel pour chauffages, humidificateurs et tests avec charge réelle.',
    safeguards: [
      'Le démarrage et la perte du capteur mettent le relais sur OFF.',
      'Le délai minimal entre changements évite les commutations rapides.',
      'Le diagnostic montre dernière lecture, RSSI, firmware Shelly et raison de décision.'
    ]
  },
  preview: {
    ...en.preview,
    aria: 'Aperçu de l’app Local Climate Link',
    tabs: { shelly: 'Shelly', sensors: 'Capteurs', rule: 'Règle', diag: 'Diag' },
    addThermometer: 'Ajouter un thermomètre',
    sensorName: 'Salon'
  },
  instructions: {
    title: 'Démarrage',
    body: 'Cette première page publique mène vers la bêta Android et les tests matériels avant les stores.',
    items: [
      'Installe PVVX/BTHome v2 ou utilise un TP357 compatible.',
      'Ajoute Shelly Plug S Gen3 avec Matter désactivé pour Shelly Scripts.',
      'Définis la règle et lance le test relais sécurisé.',
      'Branche l’appareil final seulement après un test réussi.'
    ]
  },
  beta: {
    title: 'Téléchargement de la bêta Android',
    body: 'Télécharge l’APK signé depuis GitHub Releases. Les stores officiels suivront après la checklist release candidate.',
    joinCta: 'Télécharger l’APK'
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        question: 'Le téléphone doit-il rester allumé ?',
        answer:
          'Non. Le téléphone ne sert qu’à configurer. Après téléversement, le script local tourne sur Shelly.'
      },
      {
        question: 'Faut-il le cloud ou Home Assistant ?',
        answer:
          'Non par défaut. Local Climate Link évite les hubs, MQTT et serveurs 24/7.'
      },
      {
        question: 'Tous les appareils BLE sont-ils compatibles ?',
        answer:
          'Non. Le MVP prend en charge un chemin précis : Xiaomi/PVVX BTHome v2, TP357 et Shelly Plug S Gen3.'
      }
    ]
  },
  footer: {
    tagline: 'Local Climate Link — climat local sans hub.',
    privacy: 'Confidentialité'
  }
};

const it: LandingMessages = {
  ...en,
  meta: {
    title: 'Local Climate Link — termostato senza hub',
    description:
      'Local Climate Link configura un termostato locale BLE + Shelly senza hub, cloud, MQTT o telefono in background.'
  },
  nav: {
    howItWorks: 'Come funziona',
    hardware: 'Hardware',
    safety: 'Sicurezza',
    sectionsAria: 'Sezioni della pagina'
  },
  common: {
    brand: 'Local Climate Link',
    betaCta: 'Scarica beta',
    androidBetaCta: 'Scarica beta Android',
    compatibilityCta: 'Vedi compatibilità'
  },
  hero: {
    title: 'Termostato senza hub',
    body: 'Un termometro BLE più una presa Shelly. Lo configuri una volta nell’app e funziona localmente senza cloud, MQTT o telefono in background.',
    actionsAria: 'Azioni principali'
  },
  workflow: {
    title: 'Automazione locale in tre passaggi',
    body: 'L’app non controlla il clima in background. Prepara Shelly a lavorare da solo.',
    steps: [
      {
        title: 'L’app trova l’hardware',
        text: 'Scansiona il termometro BLE e controlla Shelly tramite IP locale.'
      },
      {
        title: 'Imposti la regola',
        text: 'Scegli riscaldamento, raffreddamento, umidificazione, deumidificazione o VPD dentro un intervallo di umidità noto.'
      },
      {
        title: 'Shelly lavora da solo',
        text: 'L’app carica lo script. Il telefono può lasciare la rete e l’automazione resta locale.'
      }
    ]
  },
  hardware: {
    title: 'Lista hardware corta, meno tentativi',
    body: 'L’MVP supporta volutamente pochi dispositivi. Regole, parser BLE e diagnostica restano testati su un set concreto.',
    items: [
      {
        ...hardwareItems[0],
        role: 'relè locale e controller runtime',
        detail:
          'Lo script gira sul firmware Shelly originale, senza Home Assistant o MQTT.'
      },
      {
        ...hardwareItems[1],
        role: 'termometro BLE con BTHome v2',
        detail: 'Il profilo MVP principale: un beacon BLE leggero e parser lato Shelly.'
      },
      {
        ...hardwareItems[2],
        role: 'secondo sensore supportato',
        detail: 'Profilo e parser dedicati per utenti con un beacon TP357 personalizzato.'
      }
    ]
  },
  safety: {
    title: 'Progettato per una presa reale, non per una demo cloud',
    body: 'La direzione sicura predefinita è OFF. Conta con riscaldatori, umidificatori e test con carico reale.',
    safeguards: [
      'Avvio e guasto del sensore portano il relè su OFF.',
      'Il tempo minimo tra cambi evita commutazioni rapide.',
      'La diagnostica mostra ultima lettura, RSSI, firmware Shelly e motivo della decisione.'
    ]
  },
  preview: {
    ...en.preview,
    aria: 'Anteprima dell’app Local Climate Link',
    tabs: { shelly: 'Shelly', sensors: 'Sensori', rule: 'Regola', diag: 'Diag' },
    addThermometer: 'Aggiungi termometro',
    sensorName: 'Soggiorno'
  },
  instructions: {
    title: 'Primi passi',
    body: 'Questa prima pagina pubblica porta alla beta Android e ai test hardware prima degli store.',
    items: [
      'Installa PVVX/BTHome v2 o usa un TP357 supportato.',
      'Aggiungi Shelly Plug S Gen3 con Matter disattivato per Shelly Scripts.',
      'Imposta la regola ed esegui il test sicuro del relè.',
      'Collega il dispositivo finale solo dopo il test superato.'
    ]
  },
  beta: {
    title: 'Download beta Android',
    body: 'Scarica l’APK firmato da GitHub Releases. Gli store ufficiali arriveranno dopo la checklist release candidate.',
    joinCta: 'Scarica APK'
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        question: 'Il telefono deve funzionare sempre?',
        answer:
          'No. Il telefono è solo il configuratore. Dopo il caricamento, lo script locale gira su Shelly.'
      },
      {
        question: 'Serve cloud o Home Assistant?',
        answer: 'No di default. Local Climate Link evita hub, MQTT e server 24/7.'
      },
      {
        question: 'Supporta qualsiasi dispositivo BLE?',
        answer:
          'No. L’MVP supporta un percorso preciso: Xiaomi/PVVX BTHome v2, TP357 e Shelly Plug S Gen3.'
      }
    ]
  },
  footer: {
    tagline: 'Local Climate Link — clima locale senza hub.',
    privacy: 'Privacy'
  }
};

const ptBr: LandingMessages = {
  ...en,
  meta: {
    title: 'Local Climate Link — termostato sem hub',
    description:
      'Local Climate Link configura um termostato local BLE + Shelly sem hub, nuvem, MQTT ou telefone em segundo plano.'
  },
  nav: {
    howItWorks: 'Como funciona',
    hardware: 'Hardware',
    safety: 'Segurança',
    sectionsAria: 'Seções da página'
  },
  common: {
    brand: 'Local Climate Link',
    betaCta: 'Baixar beta',
    androidBetaCta: 'Baixar beta Android',
    compatibilityCta: 'Ver compatibilidade'
  },
  hero: {
    title: 'Termostato sem hub',
    body: 'Um termômetro BLE mais uma tomada Shelly. Configure uma vez no app e ele funciona localmente sem nuvem, MQTT ou telefone em segundo plano.',
    actionsAria: 'Ações principais'
  },
  workflow: {
    title: 'Automação local em três passos',
    body: 'O app não controla o clima em segundo plano. Ele prepara a Shelly para trabalhar sozinha.',
    steps: [
      {
        title: 'O app encontra o hardware',
        text: 'Escaneie o termômetro BLE e verifique a Shelly pelo IP local.'
      },
      {
        title: 'Você define a regra',
        text: 'Escolha aquecer, resfriar, umidificar, desumidificar ou VPD dentro de uma faixa conhecida de umidade.'
      },
      {
        title: 'A Shelly trabalha sozinha',
        text: 'O app envia o script. O telefone pode sair da rede e a automação continua local.'
      }
    ]
  },
  hardware: {
    title: 'Lista curta de hardware, menos tentativa e erro',
    body: 'O MVP suporta poucos dispositivos de propósito. Assim regras, parser BLE e diagnóstico são testados em um conjunto concreto.',
    items: [
      {
        ...hardwareItems[0],
        role: 'relé local e controlador em runtime',
        detail: 'O script roda no firmware Shelly original, sem Home Assistant ou MQTT.'
      },
      {
        ...hardwareItems[1],
        role: 'termômetro BLE com BTHome v2',
        detail:
          'O perfil principal do MVP: um beacon BLE leve e parser no lado da Shelly.'
      },
      {
        ...hardwareItems[2],
        role: 'segundo sensor compatível',
        detail: 'Perfil e parser dedicados para usuários com beacon TP357 personalizado.'
      }
    ]
  },
  safety: {
    title: 'Projetado para uma tomada real, não uma demo em nuvem',
    body: 'A direção segura padrão é OFF. Isso importa com aquecedores, umidificadores e testes com carga real.',
    safeguards: [
      'Inicialização e falha do sensor colocam o relé em OFF.',
      'O tempo mínimo entre mudanças evita chaveamento rápido.',
      'O diagnóstico mostra última leitura, RSSI, firmware Shelly e motivo da decisão.'
    ]
  },
  preview: {
    ...en.preview,
    aria: 'Prévia do app Local Climate Link',
    tabs: { shelly: 'Shelly', sensors: 'Sensores', rule: 'Regra', diag: 'Diag' },
    addThermometer: 'Adicionar termômetro',
    sensorName: 'Sala'
  },
  instructions: {
    title: 'Primeiros passos',
    body: 'Esta primeira página pública leva à beta Android e aos testes de hardware antes das lojas oficiais.',
    items: [
      'Instale PVVX/BTHome v2 ou use um TP357 compatível.',
      'Adicione Shelly Plug S Gen3 com Matter desativado para Shelly Scripts.',
      'Defina a regra e execute o teste seguro do relé.',
      'Conecte o aparelho final somente depois do teste aprovado.'
    ]
  },
  beta: {
    title: 'Download da beta Android',
    body: 'Baixe o APK assinado no GitHub Releases. As lojas oficiais vêm depois da checklist de release candidate.',
    joinCta: 'Baixar APK'
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        question: 'O telefone precisa ficar ligado o tempo todo?',
        answer:
          'Não. O telefone é apenas o configurador. Depois do envio, o script local roda na Shelly.'
      },
      {
        question: 'Preciso de nuvem ou Home Assistant?',
        answer: 'Não por padrão. Local Climate Link evita hubs, MQTT e servidor 24/7.'
      },
      {
        question: 'Qualquer dispositivo BLE é compatível?',
        answer:
          'Não. O MVP suporta um caminho específico: Xiaomi/PVVX BTHome v2, TP357 e Shelly Plug S Gen3.'
      }
    ]
  },
  footer: {
    tagline: 'Local Climate Link — clima local sem hub.',
    privacy: 'Privacidade'
  }
};

export const landingMessages: Record<LandingLocale, LandingMessages> = {
  pl,
  en,
  de,
  es,
  fr,
  it,
  'pt-BR': ptBr
};

const localeAliases: Readonly<Record<string, LandingLocale>> = {
  pt: 'pt-BR'
};

const normalizeLanguageTag = (languageTag: string): string =>
  languageTag.trim().toLowerCase().replace(/_/g, '-');

const isLandingLocale = (value: string): value is LandingLocale =>
  landingLocales.includes(value as LandingLocale);

const browserLanguageTags = (): readonly string[] => {
  if (typeof navigator === 'undefined') {
    return [];
  }

  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [];
  return navigator.language ? [...languages, navigator.language] : languages;
};

export const resolveLandingLocale = (
  languageTags: readonly string[] = browserLanguageTags()
): LandingLocale => {
  for (const languageTag of languageTags) {
    const normalizedTag = normalizeLanguageTag(languageTag);
    const exactLocale = landingLocales.find(
      (locale) => locale.toLowerCase() === normalizedTag
    );
    if (exactLocale) {
      return exactLocale;
    }

    const language = normalizedTag.split('-')[0] ?? '';
    if (isLandingLocale(language)) {
      return language;
    }

    const aliasedLocale = localeAliases[language];
    if (aliasedLocale) {
      return aliasedLocale;
    }
  }

  return 'en';
};
