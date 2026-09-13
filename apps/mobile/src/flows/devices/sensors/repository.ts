import {
  createRegistryRepository,
  type RegistryStorage
} from '../../registry/repository.js';
import { savedSensorSchema } from './model.js';

export const SENSORS_STORAGE_KEY = 'lcl.sensors.v1';
export const createSensorRepository = (storage?: RegistryStorage | null) =>
  createRegistryRepository(SENSORS_STORAGE_KEY, savedSensorSchema, storage);
