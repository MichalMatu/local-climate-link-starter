const stableStringifyValue = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringifyValue).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringifyValue(entry)}`)
    .join(',')}}`;
};

export const stableStringify = (value: unknown): string => stableStringifyValue(value);

export const configHash = (value: unknown): string => {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `lcl-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};
