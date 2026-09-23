import {
  useInstalledAutomationStore,
  type ClimateInstalledAutomation
} from '../features/automations/index.js';
import type { SetupIntent } from '../flows/setup-intent.js';

export type AutomationEditSetupRoute = {
  type: 'setup';
  intent: SetupIntent;
  sourceKind: 'climate';
  shellyId: string;
  editInstallationId: string;
};

export const automationDetailRoute = (installationId: string) => ({
  type: 'installation' as const,
  installationId,
  kind: 'climate' as const
});

export const prepareAutomationEditRoute = (
  installationId: string,
  loadClimateDraft: (installation: ClimateInstalledAutomation) => void
): AutomationEditSetupRoute | null => {
  const installation = useInstalledAutomationStore
    .getState()
    .installations.find((candidate) => candidate.id === installationId);
  if (!installation) return null;

  if (installation.kind === 'climate') {
    loadClimateDraft(installation);
  }

  return {
    type: 'setup',
    intent:
      installation.kind === 'time'
        ? 'time'
        : installation.config.rule.control.metric === 'humidity'
          ? 'humidity'
          : 'temperature',
    sourceKind: 'climate',
    shellyId: installation.shelly.deviceId,
    editInstallationId: installation.id
  };
};
