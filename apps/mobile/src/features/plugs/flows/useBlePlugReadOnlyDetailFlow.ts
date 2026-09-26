import { useQuery } from '@tanstack/react-query';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { useSavedBlePlugStore } from '../state/savedBlePlugStore.js';
import { readSavedBlePlugReadOnlyDetail } from './readSavedBlePlugReadOnlyDetail.js';

export const blePlugReadOnlyDetailQueryKey = (plug: SavedBlePlug | undefined) =>
  [
    'ble-plug-read-only-detail',
    plug?.physicalId ?? 'missing',
    plug?.bleDeviceId ?? 'missing'
  ] as const;

export const useBlePlugReadOnlyDetailFlow = (plug: SavedBlePlug | undefined) => {
  const replaceLocator = useSavedBlePlugStore((state) => state.replaceLocator);

  return useQuery({
    queryKey: blePlugReadOnlyDetailQueryKey(plug),
    queryFn: () => {
      if (!plug) throw new Error('Saved BLE Plug is missing.');
      return readSavedBlePlugReadOnlyDetail(plug, { persistLocator: replaceLocator });
    },
    enabled: Boolean(plug),
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });
};
