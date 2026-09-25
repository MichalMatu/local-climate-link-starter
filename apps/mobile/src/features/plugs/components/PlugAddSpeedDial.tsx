import { IconBluetooth, IconPlus, IconWifi } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from '../../../app/i18n.js';
import './PlugAddSpeedDial.css';

export type PlugAddTransport = 'wifi' | 'bluetooth';

export type PlugAddSpeedDialProps = {
  onSelect(transport: PlugAddTransport): void;
};

export const PlugAddSpeedDial = ({ onSelect }: PlugAddSpeedDialProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const addLabel = t('hardware.shelly.add');

  const select = (transport: PlugAddTransport) => {
    setExpanded(false);
    onSelect(transport);
  };

  return (
    <div
      className={`plug-add-speed-dial${expanded ? ' plug-add-speed-dial--expanded' : ''}`}
    >
      <button
        className="plug-add-speed-dial__action plug-add-speed-dial__action--wifi"
        type="button"
        aria-label="Wi-Fi"
        title="Wi-Fi"
        tabIndex={expanded ? 0 : -1}
        onClick={() => select('wifi')}
      >
        <IconWifi aria-hidden="true" />
      </button>
      <button
        className="plug-add-speed-dial__action plug-add-speed-dial__action--bluetooth"
        type="button"
        aria-label={t('common.bluetooth')}
        title={t('common.bluetooth')}
        tabIndex={expanded ? 0 : -1}
        onClick={() => select('bluetooth')}
      >
        <IconBluetooth aria-hidden="true" />
      </button>
      <button
        className="dashboard-fab plug-add-speed-dial__trigger"
        type="button"
        aria-label={addLabel}
        title={addLabel}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <IconPlus className="dashboard-fab__icon" aria-hidden="true" />
      </button>
    </div>
  );
};
