export interface RedactionOptions {
  redactIp?: boolean;
  redactMac?: boolean;
}

const SECRET_KEY_PATTERN = /(token|secret|password|authorization|auth|api[-_]?key)/i;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const MAC_PATTERN = /\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi;

export const redactString = (value: string, options: RedactionOptions = {}): string => {
  let redacted = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/gho_[A-Za-z0-9_]+/g, '[REDACTED_TOKEN]');

  if (options.redactIp) {
    redacted = redacted.replace(IPV4_PATTERN, '[REDACTED_IP]');
  }

  if (options.redactMac) {
    redacted = redacted.replace(MAC_PATTERN, '[REDACTED_MAC]');
  }

  return redacted;
};

export const redactValue = (value: unknown, options: RedactionOptions = {}): unknown => {
  if (typeof value === 'string') {
    return redactString(value, options);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, options));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redactValue(entry, options)
      ])
    );
  }

  return value;
};
