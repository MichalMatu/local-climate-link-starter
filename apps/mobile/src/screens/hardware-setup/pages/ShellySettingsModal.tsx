import { Modal } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';
import type { ShellyDraftDevice } from '../../../flows/hardware-setup/setupDraftStore.js';
import type { ShellySetupFlow } from '../pageContracts.js';
import { ShellySettingsContent } from './ShellySettingsContent.js';

type ShellySettingsModalProps = {
  flow: ShellySetupFlow;
  device: ShellyDraftDevice | null;
  enableBleDiscovery: boolean;
  onClose(): void;
  onBleScan(device: ShellyDraftDevice): void;
  onRemove(device: ShellyDraftDevice): void;
};

export const ShellySettingsModal = ({
  flow,
  device,
  enableBleDiscovery,
  onClose,
  onBleScan,
  onRemove
}: ShellySettingsModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      busy={flow.recheckShellyMutation.isPending}
      closeLabel={t('common.close')}
      open={device !== null}
      title={device?.name ?? t('hardware.shelly.settings')}
      onClose={onClose}
    >
      {device && (
        <ShellySettingsContent
          flow={flow}
          device={device}
          enableBleDiscovery={enableBleDiscovery}
          onBleScan={onBleScan}
          onRemove={onRemove}
        />
      )}
    </Modal>
  );
};
