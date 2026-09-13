import {
  createRegistryRepository,
  type RegistryStorage
} from '../registry/repository.js';
import { automationRuleSchema } from './model.js';

export const RULES_STORAGE_KEY = 'lcl.rules.v1';
export const createRuleRepository = (storage?: RegistryStorage | null) =>
  createRegistryRepository(RULES_STORAGE_KEY, automationRuleSchema, storage);
