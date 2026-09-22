import { supportsShellyRuntimeConfigPersistence } from './runtimeConfig.js';

export const supportsShellyMultiSensorRuntime = (script: string): boolean =>
  supportsShellyRuntimeConfigPersistence(script) &&
  script.includes('function vs(c)') &&
  script.includes('function av(v,t,n)') &&
  script.includes('function ix(a)');

export const supportsShellyPerSensorDiagnosticsRuntime = (script: string): boolean =>
  supportsShellyRuntimeConfigPersistence(script) &&
  script.includes('function pd()') &&
  script.includes('d:pd()');
