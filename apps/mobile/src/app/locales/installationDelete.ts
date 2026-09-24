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
      'Po potwierdzeniu stanu OFF Shelly Link usunie wszystkie skrypty Shelly z tego gniazdka. Wpis automatyki zniknie z aplikacji dopiero po potwierdzeniu pustej listy skryptów.',
    failed: 'Nie udało się bezpiecznie usunąć automatyki. Wpis pozostał w aplikacji.'
  },
  en: {
    action: 'Delete automation',
    busy: 'Deleting automation…',
    title: 'Delete climate automation?',
    detail:
      'After OFF is confirmed, Shelly Link will remove all Shelly scripts from this Plug. The automation entry is removed only after Shelly confirms the script list is empty.',
    failed: 'The automation could not be deleted safely. The app entry was kept.'
  },
  de: {
    action: 'Automation löschen',
    busy: 'Automation wird gelöscht…',
    title: 'Klima-Automation löschen?',
    detail:
      'Nachdem OFF bestätigt wurde, entfernt Shelly Link alle Shelly-Skripte von diesem Plug. Der Automationseintrag wird erst gelöscht, wenn Shelly eine leere Skriptliste bestätigt.',
    failed:
      'Die Automation konnte nicht sicher gelöscht werden. Der App-Eintrag bleibt erhalten.'
  },
  es: {
    action: 'Eliminar automatización',
    busy: 'Eliminando automatización…',
    title: '¿Eliminar la automatización climática?',
    detail:
      'Después de confirmar OFF, Shelly Link eliminará todos los scripts de Shelly de este enchufe. La entrada de automatización solo se elimina cuando Shelly confirma que la lista de scripts está vacía.',
    failed:
      'No se pudo eliminar la automatización de forma segura. La entrada se mantuvo en la app.'
  },
  fr: {
    action: 'Supprimer l’automatisation',
    busy: 'Suppression de l’automatisation…',
    title: 'Supprimer l’automatisation climatique ?',
    detail:
      'Après confirmation de l’état OFF, Shelly Link supprimera tous les scripts Shelly de cette prise. L’entrée d’automatisation n’est supprimée qu’après confirmation d’une liste de scripts vide.',
    failed:
      'L’automatisation n’a pas pu être supprimée en toute sécurité. L’entrée a été conservée dans l’app.'
  },
  it: {
    action: 'Elimina automazione',
    busy: 'Eliminazione automazione…',
    title: 'Eliminare l’automazione climatica?',
    detail:
      'Dopo la conferma dello stato OFF, Shelly Link rimuoverà tutti gli script Shelly da questa presa. La voce dell’automazione viene rimossa solo dopo che Shelly conferma che l’elenco degli script è vuoto.',
    failed:
      'Non è stato possibile eliminare l’automazione in sicurezza. La voce è rimasta nell’app.'
  },
  'pt-BR': {
    action: 'Excluir automação',
    busy: 'Excluindo automação…',
    title: 'Excluir a automação de clima?',
    detail:
      'Depois que o estado OFF for confirmado, o Shelly Link removerá todos os scripts Shelly desta tomada. A entrada da automação só é removida depois que o Shelly confirma que a lista de scripts está vazia.',
    failed:
      'Não foi possível excluir a automação com segurança. A entrada foi mantida no app.'
  }
};
