import { Modal } from '@lcl/ui';
import { useTranslation } from '../../../app/i18n.js';

export type PlugDeleteConfirmModalProps = {
  deviceName: string | null;
  onClose(): void;
  onConfirm(): void;
};

export const PlugDeleteConfirmModal = ({
  deviceName,
  onClose,
  onConfirm
}: PlugDeleteConfirmModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      closeLabel={t('common.cancel')}
      description={deviceName ?? ''}
      open={deviceName !== null}
      title={t('hardware.shelly.deleteConfirmTitle')}
      actions={
        <button
          className="secondary-action secondary-action--danger"
          type="button"
          title={t('hardware.shelly.deleteTitle')}
          onClick={onConfirm}
        >
          {t('common.delete')}
        </button>
      }
      onClose={onClose}
    >
      <p>{t('hardware.shelly.deleteDescription')}</p>
    </Modal>
  );
};
