import type { Locale } from '../i18n.js';

type InstallationScriptPreviewCopy = {
  action: string;
  title: string;
  loading: string;
  failed: string;
  retry: string;
  label: string;
  copy: string;
  copyDone: string;
  copyFailed: string;
};

export const installationScriptPreviewCopy: Record<
  Locale,
  InstallationScriptPreviewCopy
> = {
  pl: {
    action: 'Pokaż wdrożony skrypt',
    title: 'Skrypt wdrożony w Shelly',
    loading: 'Pobieram aktualny kod bezpośrednio z Shelly…',
    failed: 'Nie udało się odczytać dokładnie tego skryptu z Shelly.',
    retry: 'Spróbuj ponownie',
    label: 'Aktualny kod skryptu w Shelly',
    copy: 'Kopiuj kod',
    copyDone: 'Skopiowano kod skryptu.',
    copyFailed: 'Nie udało się skopiować kodu skryptu.'
  },
  en: {
    action: 'View deployed script',
    title: 'Script deployed on Shelly',
    loading: 'Loading the current code directly from Shelly…',
    failed: 'The exact managed script could not be read from Shelly.',
    retry: 'Try again',
    label: 'Current script code on Shelly',
    copy: 'Copy code',
    copyDone: 'Script code copied.',
    copyFailed: 'Script code could not be copied.'
  },
  de: {
    action: 'Bereitgestelltes Skript anzeigen',
    title: 'Auf Shelly bereitgestelltes Skript',
    loading: 'Aktueller Code wird direkt von Shelly geladen…',
    failed: 'Das exakt verwaltete Skript konnte nicht von Shelly gelesen werden.',
    retry: 'Erneut versuchen',
    label: 'Aktueller Skriptcode auf Shelly',
    copy: 'Code kopieren',
    copyDone: 'Skriptcode kopiert.',
    copyFailed: 'Skriptcode konnte nicht kopiert werden.'
  },
  es: {
    action: 'Ver script desplegado',
    title: 'Script desplegado en Shelly',
    loading: 'Cargando el código actual directamente desde Shelly…',
    failed: 'No se pudo leer de Shelly el script gestionado exacto.',
    retry: 'Intentar de nuevo',
    label: 'Código actual del script en Shelly',
    copy: 'Copiar código',
    copyDone: 'Código del script copiado.',
    copyFailed: 'No se pudo copiar el código del script.'
  },
  fr: {
    action: 'Voir le script déployé',
    title: 'Script déployé sur Shelly',
    loading: 'Chargement du code actuel directement depuis Shelly…',
    failed: 'Impossible de lire depuis Shelly le script géré exact.',
    retry: 'Réessayer',
    label: 'Code actuel du script sur Shelly',
    copy: 'Copier le code',
    copyDone: 'Code du script copié.',
    copyFailed: 'Impossible de copier le code du script.'
  },
  it: {
    action: 'Mostra script distribuito',
    title: 'Script distribuito su Shelly',
    loading: 'Caricamento del codice attuale direttamente da Shelly…',
    failed: 'Non è stato possibile leggere da Shelly lo script gestito esatto.',
    retry: 'Riprova',
    label: 'Codice attuale dello script su Shelly',
    copy: 'Copia codice',
    copyDone: 'Codice dello script copiato.',
    copyFailed: 'Non è stato possibile copiare il codice dello script.'
  },
  'pt-BR': {
    action: 'Ver script implantado',
    title: 'Script implantado no Shelly',
    loading: 'Carregando o código atual diretamente do Shelly…',
    failed: 'Não foi possível ler do Shelly o script gerenciado exato.',
    retry: 'Tentar novamente',
    label: 'Código atual do script no Shelly',
    copy: 'Copiar código',
    copyDone: 'Código do script copiado.',
    copyFailed: 'Não foi possível copiar o código do script.'
  }
};
