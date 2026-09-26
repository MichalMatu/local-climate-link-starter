import { isSameShellyDevice } from '../data/shellyDeviceIdentity.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import { BleOnlyPlugCard } from './BleOnlyPlugCard.js';

export type BleOnlyPlugDashboardCardsProps = {
  plugs: readonly SavedBlePlug[];
  representedPhysicalIds: readonly string[];
  onNameChange(physicalId: string, value: string): void;
};

export const BleOnlyPlugDashboardCards = ({
  plugs,
  representedPhysicalIds,
  onNameChange
}: BleOnlyPlugDashboardCardsProps) =>
  plugs
    .filter(
      (plug) =>
        !representedPhysicalIds.some((physicalId) =>
          isSameShellyDevice(physicalId, plug.physicalId)
        )
    )
    .map((plug) => (
      <BleOnlyPlugCard
        key={`ble-plug:${plug.physicalId}`}
        plug={plug}
        onNameChange={(value) => onNameChange(plug.physicalId, value)}
      />
    ));
