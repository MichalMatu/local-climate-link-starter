import {
  isRecoverableBlePlugRuntimeReadError,
  readBlePlugRuntimeStatus,
  type BlePlugRuntimeStatus
} from '../data/blePlugRuntime.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import {
  recoverSavedBlePlugLocator,
  type SavedBlePlugLocatorRecoveryDependencies,
  type SavedBlePlugLocatorRecoveryOptions
} from './recoverSavedBlePlugLocator.js';

export { PLUG_BLE_LOCATOR_RECOVERY_MAX_CANDIDATES } from './recoverSavedBlePlugLocator.js';

export type SavedBlePlugRuntimeRecoveryOptions = SavedBlePlugLocatorRecoveryOptions;

export type SavedBlePlugRuntimeRecoveryDependencies =
  SavedBlePlugLocatorRecoveryDependencies & {
    readStatus?(plug: Pick<SavedBlePlug, 'bleDeviceId'>): Promise<BlePlugRuntimeStatus>;
  };

export const readSavedBlePlugRuntimeStatus = async (
  plug: SavedBlePlug,
  options: SavedBlePlugRuntimeRecoveryOptions,
  dependencies: SavedBlePlugRuntimeRecoveryDependencies = {}
): Promise<BlePlugRuntimeStatus> => {
  const readStatus = dependencies.readStatus ?? readBlePlugRuntimeStatus;

  try {
    return await readStatus(plug);
  } catch (error) {
    if (!isRecoverableBlePlugRuntimeReadError(error)) throw error;
  }

  const bleDeviceId = await recoverSavedBlePlugLocator(plug, options, dependencies);
  return readStatus({ bleDeviceId });
};
