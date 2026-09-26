import { useQuery } from '@tanstack/react-query';
import { readBlePlugInformation } from '../data/plugInformation.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';

export const blePlugInformationQueryKey = (plug: SavedBlePlug | undefined) =>
  [
    'ble-plug-information',
    plug?.physicalId ?? 'missing',
    plug?.bleDeviceId ?? 'missing'
  ] as const;

export const useBlePlugInformationFlow = (
  plug: SavedBlePlug | undefined,
  options: { enabled?: boolean } = {}
) =>
  useQuery({
    queryKey: blePlugInformationQueryKey(plug),
    queryFn: () => {
      if (!plug) throw new Error('Saved BLE Plug is missing.');
      return readBlePlugInformation(plug);
    },
    enabled: Boolean(plug) && (options.enabled ?? true),
    retry: false,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
