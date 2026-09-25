import { PlugAddMethodPage } from './PlugAddMethodPage.js';
import type { PlugAddPageProps } from './PlugAddPage.js';
import { usePlugBleAddFlow } from '../flows/usePlugBleAddFlow.js';

export type PlugAddPageContainerProps = PlugAddPageProps;

export const PlugAddPageContainer = ({ manual, scan }: PlugAddPageContainerProps) => {
  const bluetooth = usePlugBleAddFlow();

  return (
    <PlugAddMethodPage
      manual={manual}
      scan={scan}
      bluetooth={{
        scanning: bluetooth.scanning,
        candidates: bluetooth.candidates,
        inspectingDeviceId: bluetooth.inspectingDeviceId,
        verifiedCandidate: bluetooth.verifiedCandidate,
        error: bluetooth.error,
        onStart: bluetooth.startScan,
        onStop: bluetooth.stopScan,
        onInspect: (candidate) => {
          void bluetooth.inspectCandidate(candidate);
        }
      }}
    />
  );
};
