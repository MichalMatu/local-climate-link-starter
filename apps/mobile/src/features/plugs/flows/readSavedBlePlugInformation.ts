import { isRecoverableBlePlugReadOnlyError } from '../data/blePlugReadOnlyError.js';
import {
  readBlePlugInformation,
  type PlugInformation
} from '../data/plugInformation.js';
import type { SavedBlePlug } from '../data/savedBlePlug.js';
import {
  recoverSavedBlePlugLocator,
  type SavedBlePlugLocatorRecoveryDependencies,
  type SavedBlePlugLocatorRecoveryOptions
} from './recoverSavedBlePlugLocator.js';

export type SavedBlePlugInformationRecoveryDependencies =
  SavedBlePlugLocatorRecoveryDependencies & {
    readInformation?(
      plug: Pick<SavedBlePlug, 'physicalId' | 'bleDeviceId'>
    ): Promise<PlugInformation>;
  };

export const readSavedBlePlugInformation = async (
  plug: SavedBlePlug,
  options: SavedBlePlugLocatorRecoveryOptions,
  dependencies: SavedBlePlugInformationRecoveryDependencies = {}
): Promise<PlugInformation> => {
  const readInformation = dependencies.readInformation ?? readBlePlugInformation;

  try {
    return await readInformation(plug);
  } catch (error) {
    if (!isRecoverableBlePlugReadOnlyError(error)) throw error;
  }

  const bleDeviceId = await recoverSavedBlePlugLocator(plug, options, dependencies);
  return readInformation({ physicalId: plug.physicalId, bleDeviceId });
};
