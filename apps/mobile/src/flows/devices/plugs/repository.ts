import {
  createRegistryRepository,
  type RegistryStorage
} from '../../registry/repository.js';
import { savedPlugSchema } from './model.js';

export const PLUGS_STORAGE_KEY = 'lcl.plugs.v1';
export const createPlugRepository = (storage?: RegistryStorage | null) =>
  createRegistryRepository(PLUGS_STORAGE_KEY, savedPlugSchema, storage);
