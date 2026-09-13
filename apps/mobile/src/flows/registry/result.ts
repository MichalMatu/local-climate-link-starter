export type RegistryError =
  | { kind: 'validation-failed' }
  | { kind: 'storage-unavailable' }
  | { kind: 'storage-invalid' }
  | { kind: 'device-referenced'; ruleIds: string[] }
  | { kind: 'device-missing'; deviceKind: 'plug' | 'sensor'; deviceId: string }
  | { kind: 'deployment-attached'; ruleId: string };

export type RegistryResult<T> =
  { ok: true; value: T } | { ok: false; error: RegistryError };
