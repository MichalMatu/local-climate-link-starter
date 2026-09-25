import { useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import {
  PlugAddPage,
  type PlugAddPageProps
} from './PlugAddPage.js';
import {
  PlugBluetoothAddPanel,
  type PlugBluetoothAddPanelProps
} from './PlugBluetoothAddPanel.js';

export type PlugAddMethodPageProps = PlugAddPageProps & {
  bluetooth: PlugBluetoothAddPanelProps;
};

export const PlugAddMethodPage = ({
  manual,
  scan,
  bluetooth
}: PlugAddMethodPageProps) => {
  const { t } = useTranslation();
  const [method, setMethod] = useState<'wifi' | 'bluetooth'>('wifi');

  const selectMethod = (next: 'wifi' | 'bluetooth') => {
    if (next === method) return;
    if (method === 'wifi' && scan.active) scan.onStop();
    if (method === 'bluetooth' && bluetooth.scanning) bluetooth.onStop();
    setMethod(next);
  };

  return (
    <div className="device-add-page__body">
      <div
        className="shelly-add-tabs lcl-segmented-control"
        role="tablist"
        aria-label={t('hardware.shelly.add')}
      >
        <button
          className="shelly-add-tabs__tab lcl-segmented-control__item"
          type="button"
          role="tab"
          aria-selected={method === 'wifi'}
          onClick={() => selectMethod('wifi')}
        >
          Wi-Fi
        </button>
        <button
          className="shelly-add-tabs__tab lcl-segmented-control__item"
          type="button"
          role="tab"
          aria-selected={method === 'bluetooth'}
          onClick={() => selectMethod('bluetooth')}
        >
          {t('common.bluetooth')}
        </button>
      </div>

      {method === 'wifi' ? (
        <PlugAddPage manual={manual} scan={scan} />
      ) : (
        <PlugBluetoothAddPanel {...bluetooth} />
      )}
    </div>
  );
};
