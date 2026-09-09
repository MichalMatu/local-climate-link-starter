import type { Locale } from '../i18n.js';
import type { InstallationRecoveryIssue } from '../../flows/installations/healthRecovery.js';

type RecoveryIssueCopy = {
  title: string;
  description: string;
  action: string;
};

type InstallationHealthCopy = {
  eyebrow: string;
  issues: Record<InstallationRecoveryIssue, RecoveryIssueCopy>;
};

export const installationHealthCopy: Record<Locale, InstallationHealthCopy> = {
  pl: {
    eyebrow: 'Stan instalacji',
    issues: {
      offline: {
        title: 'Shelly offline',
        description:
          'Nie można połączyć się z Shelly. Sprawdź połączenie sieciowe urządzenia i spróbuj ponownie.',
        action: 'Sprawdź ponownie'
      },
      'script-stopped': {
        title: 'Skrypt zatrzymany',
        description:
          'Automatyka klimatu nie działa, dopóki jej skrypt Shelly pozostaje zatrzymany.',
        action: 'Uruchom automatykę'
      },
      'sensor-missing': {
        title: 'Brak świeżych danych z czujnika',
        description: 'Shelly nie otrzymuje świeżych danych z przypisanego czujnika BLE.',
        action: 'Sprawdź ponownie'
      },
      'ownership-problem': {
        title: 'Problem właściciela wyjścia',
        description:
          'Zapisana instalacja nie odpowiada skryptowi Local Climate Link na tym Shelly. Aplikacja nie przejmie wyjścia automatycznie.',
        action: 'Sprawdź ponownie'
      }
    }
  },
  en: {
    eyebrow: 'Installation health',
    issues: {
      offline: {
        title: 'Shelly offline',
        description:
          'Shelly cannot be reached. Check the device network connection and try again.',
        action: 'Check again'
      },
      'script-stopped': {
        title: 'Script stopped',
        description:
          'Climate automation is not running while its Shelly Script remains stopped.',
        action: 'Start automation'
      },
      'sensor-missing': {
        title: 'No fresh sensor data',
        description: 'Shelly is not receiving fresh data from the assigned BLE sensor.',
        action: 'Check again'
      },
      'ownership-problem': {
        title: 'Output ownership problem',
        description:
          'The saved installation no longer matches the Local Climate Link script on this Shelly. The app will not take over the output automatically.',
        action: 'Check again'
      }
    }
  },
  de: {
    eyebrow: 'Anlagenstatus',
    issues: {
      offline: {
        title: 'Shelly offline',
        description:
          'Shelly ist nicht erreichbar. Prüfe die Netzwerkverbindung des Geräts und versuche es erneut.',
        action: 'Erneut prüfen'
      },
      'script-stopped': {
        title: 'Skript gestoppt',
        description:
          'Die Klimaautomatik läuft nicht, solange das Shelly-Skript gestoppt ist.',
        action: 'Automatik starten'
      },
      'sensor-missing': {
        title: 'Keine aktuellen Sensordaten',
        description: 'Shelly empfängt keine aktuellen Daten vom zugewiesenen BLE-Sensor.',
        action: 'Erneut prüfen'
      },
      'ownership-problem': {
        title: 'Problem mit der Ausgangssteuerung',
        description:
          'Die gespeicherte Anlage stimmt nicht mehr mit dem Local-Climate-Link-Skript auf diesem Shelly überein. Die App übernimmt den Ausgang nicht automatisch.',
        action: 'Erneut prüfen'
      }
    }
  },
  es: {
    eyebrow: 'Estado de la instalación',
    issues: {
      offline: {
        title: 'Shelly sin conexión',
        description:
          'No se puede contactar con Shelly. Comprueba la conexión de red del dispositivo y vuelve a intentarlo.',
        action: 'Comprobar de nuevo'
      },
      'script-stopped': {
        title: 'Script detenido',
        description:
          'La automatización climática no funciona mientras el script de Shelly esté detenido.',
        action: 'Iniciar automatización'
      },
      'sensor-missing': {
        title: 'Sin datos recientes del sensor',
        description: 'Shelly no está recibiendo datos recientes del sensor BLE asignado.',
        action: 'Comprobar de nuevo'
      },
      'ownership-problem': {
        title: 'Problema de control de la salida',
        description:
          'La instalación guardada ya no coincide con el script de Local Climate Link en este Shelly. La aplicación no tomará el control de la salida automáticamente.',
        action: 'Comprobar de nuevo'
      }
    }
  },
  fr: {
    eyebrow: "État de l'installation",
    issues: {
      offline: {
        title: 'Shelly hors ligne',
        description:
          "Shelly est injoignable. Vérifiez la connexion réseau de l'appareil puis réessayez.",
        action: 'Vérifier à nouveau'
      },
      'script-stopped': {
        title: 'Script arrêté',
        description:
          "L'automatisation climatique ne fonctionne pas tant que le script Shelly reste arrêté.",
        action: "Démarrer l'automatisation"
      },
      'sensor-missing': {
        title: 'Aucune donnée récente du capteur',
        description: 'Shelly ne reçoit pas de données récentes du capteur BLE assigné.',
        action: 'Vérifier à nouveau'
      },
      'ownership-problem': {
        title: 'Problème de contrôle de la sortie',
        description:
          "L'installation enregistrée ne correspond plus au script Local Climate Link de ce Shelly. L'application ne prendra pas automatiquement le contrôle de la sortie.",
        action: 'Vérifier à nouveau'
      }
    }
  },
  it: {
    eyebrow: "Stato dell'installazione",
    issues: {
      offline: {
        title: 'Shelly offline',
        description:
          'Shelly non è raggiungibile. Controlla la connessione di rete del dispositivo e riprova.',
        action: 'Controlla di nuovo'
      },
      'script-stopped': {
        title: 'Script arrestato',
        description:
          'L’automazione climatica non funziona finché lo script Shelly rimane arrestato.',
        action: 'Avvia automazione'
      },
      'sensor-missing': {
        title: 'Nessun dato recente dal sensore',
        description: 'Shelly non riceve dati recenti dal sensore BLE assegnato.',
        action: 'Controlla di nuovo'
      },
      'ownership-problem': {
        title: "Problema di controllo dell'uscita",
        description:
          "L'installazione salvata non corrisponde più allo script Local Climate Link su questo Shelly. L'app non prenderà automaticamente il controllo dell'uscita.",
        action: 'Controlla di nuovo'
      }
    }
  },
  'pt-BR': {
    eyebrow: 'Saúde da instalação',
    issues: {
      offline: {
        title: 'Shelly offline',
        description:
          'Não foi possível acessar o Shelly. Verifique a conexão de rede do dispositivo e tente novamente.',
        action: 'Verificar novamente'
      },
      'script-stopped': {
        title: 'Script parado',
        description:
          'A automação de clima não funciona enquanto o script do Shelly estiver parado.',
        action: 'Iniciar automação'
      },
      'sensor-missing': {
        title: 'Sem dados recentes do sensor',
        description:
          'O Shelly não está recebendo dados recentes do sensor BLE atribuído.',
        action: 'Verificar novamente'
      },
      'ownership-problem': {
        title: 'Problema de controle da saída',
        description:
          'A instalação salva não corresponde mais ao script Local Climate Link neste Shelly. O app não assumirá o controle da saída automaticamente.',
        action: 'Verificar novamente'
      }
    }
  }
};
