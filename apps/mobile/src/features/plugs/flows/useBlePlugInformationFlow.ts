import { useQuery } from '@tanstack/react-query';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { useSavedBlePlugStore } from '../state/savedBlePlugStore.js';
import { readSavedBlePlugInformation } from './readSavedBlePlugInformation.js';

export const blePlugInformationQueryKey = (plug: SavedBlePlug | undefined) =>
  [
    'ble-plug-information',
    plug?.physicalId ?? 'missing',
    plug?.bleDeviceId ?? 'missing'
  ] as const;

export const useBlePlugInformationFlow = (
  plug: SavedBlePlug | undefined,
  options: { enabled?: boolean } = {}
) => {
  const replaceLocator = useSavedBlePlugStore((state) => state.replaceLocator);

  return useQuery({
    queryKey: blePlugInformationQueryKey(plug),
    queryFn: () => {
      if (!plug) throw new Error('Saved BLE Plug is missing.');
      return readSavedBlePlugInformation(plug, { persistLocator: replaceLocator });
    },
    enabled: Boolean(plug) && (options.enabled ?? true),
    retry: false,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
};
