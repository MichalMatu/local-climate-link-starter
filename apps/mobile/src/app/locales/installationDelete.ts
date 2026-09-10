import type { Locale } from '../i18n.js';

type InstallationDeleteCopy = {
  action: string;
  busy: string;
  title: string;
  detail: string;
  failed: string;
};

export const installationDeleteCopy: Record<Locale, InstallationDeleteCopy> = {
  pl: {
    action: 'Usuń automatykę',
    busy: 'Usuwam automatykę…',
    title: 'Usunąć automatykę klimatu?',
    detail:
      'Skrypt tej automatyki zostanie usunięty z Shelly dopiero po potwierdzeniu stanu OFF. Wpis w aplikacji zniknie dopiero po poprawnym zakończeniu operacji.',
    failed: 'Nie udało się bezpiecznie usunąć automatyki. Wpis pozostał w aplikacji.'
  },
  en: {
    action: 'Delete automation',
    busy: 'Deleting automation…',
    title: 'Delete climate automation?',
    detail:
      'This automation script will be removed from Shelly only after OFF is confirmed. The app entry is removed only after Shelly confirms the cleanup.',
    failed: 'The automation could not be deleted safely. The app entry was kept.'
  },
  de: {
    action: 'Automation löschen',
    busy: 'Automation wird gelöscht…',
    title: 'Klima-Automation löschen?',
    detail:
      'Das Skript dieser Automation wird erst von Shelly entfernt, nachdem OFF bestätigt wurde. Der Eintrag in der App wird erst nach erfolgreicher Bereinigung gelöscht.',
    failed: 'Die Automation konnte nicht sicher gelöscht werden. Der App-Eintrag bleibt erhalten.'
  },
  es: {
    action: 'Eliminar automatización',
    busy: 'Eliminando automatización…',
    title: '¿Eliminar la automatización climática?',
    detail:
      'El script de esta automatización solo se eliminará de Shelly después de confirmar OFF. La entrada de la app se elimina únicamente cuando Shelly confirma la limpieza.',
    failed: 'No se pudo eliminar la automatización de forma segura. La entrada se mantuvo en la app.'
  },
  fr: {
    action: 'Supprimer l’automatisation',
    busy: 'Suppression de l’automatisation…',
    title: 'Supprimer l’automatisation climatique ?',
    detail:
      'Le script de cette automatisation ne sera supprimé de Shelly qu’après confirmation de l’état OFF. L’entrée de l’app ne disparaît qu’après confirmation du nettoyage.',
    failed: 'L’automatisation n’a pas pu être supprimée en toute sécurité. L’entrée a été conservée dans l’app.'
  },
  it: {
    action: 'Elimina automazione',
    busy: 'Eliminazione automazione…',
    title: 'Eliminare l’automazione climatica?',
    detail:
      'Lo script di questa automazione verrà rimosso da Shelly solo dopo la conferma dello stato OFF. La voce nell’app viene rimossa solo dopo la conferma della pulizia.',
    failed: 'Non è stato possibile eliminare l’automazione in sicurezza. La voce è rimasta nell’app.'
  },
  'pt-BR': {
    action: 'Excluir automação',
    busy: 'Excluindo automação…',
    title: 'Excluir a automação de clima?',
    detail:
      'O script desta automação só será removido do Shelly depois que o estado OFF for confirmado. A entrada do app só é removida após a confirmação da limpeza.',
    failed: 'Não foi possível excluir a automação com segurança. A entrada foi mantida no app.'
  }
};
