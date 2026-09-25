import { usePlugBleAddFlow } from '../flows/usePlugBleAddFlow.js';
import { PlugBluetoothAddPanel } from './PlugBluetoothAddPanel.js';

export const PlugBluetoothAddPage = () => {
  const bluetooth = usePlugBleAddFlow();

  return (
    <main className="demo-shell hardware-shell">
      <section className="device-add-page shelly-add-page">
        <PlugBluetoothAddPanel
          scanning={bluetooth.scanning}
          candidates={bluetooth.candidates}
          inspectingDeviceId={bluetooth.inspectingDeviceId}
          verifiedCandidate={bluetooth.verifiedCandidate}
          error={bluetooth.error}
          onStart={bluetooth.startScan}
          onStop={bluetooth.stopScan}
          onInspect={(candidate) => {
            void bluetooth.inspectCandidate(candidate);
          }}
        />
      </section>
    </main>
  );
};
