import { useTranslation } from '../app/i18n.js';
import type { InstalledAutomationControlMode } from '../flows/installations/runtimeStatus.js';

type InstallationRuntimeControlsProps = {
  automationMode: InstalledAutomationControlMode | null;
  canToggleAutomation: boolean;
  relayState: boolean | undefined;
  actionBusy: boolean;
  deleteBusy: boolean;
  deleteLabel: string;
  onAuto(): void;
  onManual(): void;
  onRelayOn(): void;
  onRelayOff(): void;
  onOpenDiagnostics(): void;
  onDelete(): void;
};

export const InstallationRuntimeControls = ({
  automationMode,
  canToggleAutomation,
  relayState,
  actionBusy,
  deleteBusy,
  deleteLabel,
  onAuto,
  onManual,
  onRelayOn,
  onRelayOff,
  onOpenDiagnostics,
  onDelete
}: InstallationRuntimeControlsProps) => {
  const { t } = useTranslation();
  const manualControl = automationMode === 'manual';
  const controlsBusy = actionBusy || deleteBusy;

  return (
    <>
      <div className="installation-detail-actions installation-detail-mode-actions">
        <div
          className="automation-control-group installation-detail-mode-control"
          role="group"
          aria-label={t('detail.automation')}
        >
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={automationMode === 'auto'}
            disabled={!canToggleAutomation || controlsBusy}
            onClick={onAuto}
          >
            AUTO
          </button>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={manualControl}
            disabled={!canToggleAutomation || controlsBusy}
            onClick={onManual}
          >
            MANUAL
          </button>
        </div>
      </div>

      <div className="installation-detail-actions installation-detail-mode-actions">
        <div
          className="automation-control-group installation-detail-mode-control"
          role="group"
          aria-label={t('dashboard.output')}
        >
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={relayState === true}
            disabled={!manualControl || controlsBusy}
            onClick={onRelayOn}
          >
            ON
          </button>
          <button
            className="automation-control-button"
            type="button"
            aria-pressed={relayState === false}
            disabled={!manualControl || controlsBusy}
            onClick={onRelayOff}
          >
            OFF
          </button>
        </div>
      </div>

      <div className="installation-detail-actions">
        <button className="secondary-action" type="button" onClick={onOpenDiagnostics}>
          {t('common.diagnostics')}
        </button>
        <button
          className="secondary-action secondary-action--danger"
          type="button"
          disabled={controlsBusy}
          onClick={onDelete}
        >
          {deleteLabel}
        </button>
      </div>
    </>
  );
};
