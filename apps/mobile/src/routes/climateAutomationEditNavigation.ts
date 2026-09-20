import {
  useInstalledAutomationStore,
  type ClimateInstalledAutomation
} from '../features/automations/index.js';

export type ClimateAutomationEditSetupRoute = {
  type: 'setup';
  intent: 'temperature' | 'humidity';
  sourceKind: 'climate';
  shellyId: string;
  editInstallationId: string;
};

export const climateAutomationDetailRoute = (installationId: string) => ({
  type: 'installation' as const,
  installationId,
  kind: 'climate' as const,
  page: 'detail' as const
});

export const prepareClimateAutomationEditRoute = (
  installationId: string,
  loadDraft: (installation: ClimateInstalledAutomation) => void
): ClimateAutomationEditSetupRoute | null => {
  const installation = useInstalledAutomationStore
    .getState()
    .installations.find((candidate) => candidate.id === installationId);
  if (!installation || installation.kind !== 'climate') return null;

  loadDraft(installation);
  return {
    type: 'setup',
    intent:
      installation.config.rule.control.metric === 'humidity' ? 'humidity' : 'temperature',
    sourceKind: 'climate',
    shellyId: installation.shelly.deviceId,
    editInstallationId: installation.id
  };
};
