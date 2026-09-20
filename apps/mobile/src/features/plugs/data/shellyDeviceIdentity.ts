import { normalizeShellyDeviceId } from '@lcl/shelly-client';

export const isSameShellyDevice = (left: string, right: string): boolean =>
  normalizeShellyDeviceId(left) === normalizeShellyDeviceId(right);
