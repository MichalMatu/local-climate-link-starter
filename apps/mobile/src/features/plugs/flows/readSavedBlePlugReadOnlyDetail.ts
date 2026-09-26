import { isRecoverableBlePlugReadOnlyError } from '../data/blePlugReadOnlyError.js';
import {
  readBlePlugReadOnlyDetail,
  type PlugReadOnlyDetail
} from '../data/plugReadOnlyDetail.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import {
  recoverSavedBlePlugLocator,
  type SavedBlePlugLocatorRecoveryDependencies,
  type SavedBlePlugLocatorRecoveryOptions
} from './recoverSavedBlePlugLocator.js';

export type SavedBlePlugReadOnlyDetailRecoveryDependencies =
  SavedBlePlugLocatorRecoveryDependencies & {
    readDetail?(
      plug: Pick<SavedBlePlug, 'physicalId' | 'bleDeviceId'>
    ): Promise<PlugReadOnlyDetail>;
  };

export const readSavedBlePlugReadOnlyDetail = async (
  plug: SavedBlePlug,
  options: SavedBlePlugLocatorRecoveryOptions,
  dependencies: SavedBlePlugReadOnlyDetailRecoveryDependencies = {}
): Promise<PlugReadOnlyDetail> => {
  const readDetail = dependencies.readDetail ?? readBlePlugReadOnlyDetail;

  try {
    return await readDetail(plug);
  } catch (error) {
    if (!isRecoverableBlePlugReadOnlyError(error)) throw error;
  }

  const bleDeviceId = await recoverSavedBlePlugLocator(plug, options, dependencies);
  return readDetail({ physicalId: plug.physicalId, bleDeviceId });
};
