import { Modal } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import type { BleDiscoveryCandidate } from '../../../flows/hardware-setup/schemas.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import { ShellyBleDiscoveryContent } from './ShellyBleDiscoveryContent.js';

type ShellyBleDiscoveryModalProps = {
  flow: ShellySetupFlow;
  device: ShellyDraftDevice | null;
  open: boolean;
  onClose(): void;
  onRestart(): void;
  onSaveCandidate(candidate: BleDiscoveryCandidate): void;
};

export const ShellyBleDiscoveryModal = ({
  flow,
  device,
  open,
  onClose,
  onRestart,
  onSaveCandidate
}: ShellyBleDiscoveryModalProps) => {
  const { t } = useTranslation();
  const busy =
    flow.startBleDiscoveryMutation.isPending ||
    flow.refreshBleDiscoveryMutation.isPending ||
    flow.restartBleDiscoveryMutation.isPending ||
    flow.stopBleDiscoveryMutation.isPending;
  const shouldShowRestart = Boolean(
    flow.bleDiscoverySession && flow.bleDiscoverySnapshot?.running === false
  );

  return (
    <Modal
      busy={busy}
      closeLabel={t('common.close')}
      description={device?.name ?? ''}
      open={open}
      title={t('hardware.shelly.scanBleTitle')}
      titleInfo={{
        label: t('hardware.shelly.scanBleInfoLabel'),
        title: t('hardware.shelly.scanBleInfoTitle'),
        content: t('hardware.shelly.scanBleInfo')
      }}
      actions={
        shouldShowRestart ? (
          <button
            className="secondary-action"
            type="button"
            aria-busy={flow.restartBleDiscoveryMutation.isPending}
            disabled={busy}
            title={t('hardware.shelly.scanBleAgainTitle')}
            onClick={onRestart}
          >
            {t('hardware.shelly.scanBleAgain')}
          </button>
        ) : null
      }
      onClose={onClose}
    >
      <ShellyBleDiscoveryContent flow={flow} onSaveCandidate={onSaveCandidate} />
    </Modal>
  );
};
