import { usePlugBleAddFlow } from '../flows/usePlugBleAddFlow.js';
import { useSavedBlePlugStore } from '../state/savedBlePlugStore.js';
import { PlugBluetoothAddPanel } from './PlugBluetoothAddPanel.js';

export const PlugBluetoothAddPage = () => {
  const bluetooth = usePlugBleAddFlow();
  const savedPlugs = useSavedBlePlugStore((state) => state.plugs);
  const saveCandidate = useSavedBlePlugStore((state) => state.saveCandidate);

  return (
    <main className="demo-shell hardware-shell">
      <section className="device-add-page shelly-add-page">
        <PlugBluetoothAddPanel
          scanning={bluetooth.scanning}
          candidates={bluetooth.candidates}
          inspectingDeviceId={bluetooth.inspectingDeviceId}
          verifiedCandidates={bluetooth.verifiedCandidates}
          savedPhysicalIds={savedPlugs.map((plug) => plug.physicalId)}
          error={bluetooth.error}
          onStart={bluetooth.startScan}
          onStop={bluetooth.stopScan}
          onAdd={(candidate) => {
            void bluetooth.verifyCandidate(candidate).then((verified) => {
              if (verified) saveCandidate(verified);
            });
          }}
        />
      </section>
    </main>
  );
};
