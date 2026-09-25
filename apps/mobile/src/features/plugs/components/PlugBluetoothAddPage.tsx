import { usePlugBleAddFlow } from '../flows/usePlugBleAddFlow.js';
import { useSavedBlePlugStore } from '../state/savedBlePlugStore.js';
import { PlugBluetoothAddPanel } from './PlugBluetoothAddPanel.js';

export const PlugBluetoothAddPage = () => {
  const bluetooth = usePlugBleAddFlow();
  const savedPlugs = useSavedBlePlugStore((state) => state.plugs);
  const saveCandidate = useSavedBlePlugStore((state) => state.saveCandidate);
  const verifiedCandidateSaved =
    bluetooth.verifiedCandidate !== null &&
    savedPlugs.some(
      (plug) => plug.physicalId === bluetooth.verifiedCandidate?.physicalId
    );

  return (
    <main className="demo-shell hardware-shell">
      <section className="device-add-page shelly-add-page">
        <PlugBluetoothAddPanel
          scanning={bluetooth.scanning}
          candidates={bluetooth.candidates}
          inspectingDeviceId={bluetooth.inspectingDeviceId}
          verifiedCandidate={bluetooth.verifiedCandidate}
          verifiedCandidateSaved={verifiedCandidateSaved}
          error={bluetooth.error}
          onStart={bluetooth.startScan}
          onStop={bluetooth.stopScan}
          onInspect={(candidate) => {
            void bluetooth.inspectCandidate(candidate);
          }}
          onSaveVerified={() => {
            if (bluetooth.verifiedCandidate) {
              saveCandidate(bluetooth.verifiedCandidate);
            }
          }}
        />
      </section>
    </main>
  );
};
