import type { SensorProfileId } from '@lcl/device-profiles';
import { t } from '../../app/i18n.js';

export const normalizeShellyUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(t('hardware.validation.shellyIpRequired'));
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(t('hardware.validation.shellyIpInvalid'));
  }
  const octets = url.hostname.split('.');
  const isIpv4 =
    octets.length === 4 &&
    octets.every((part) => {
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255 && part !== '';
    });
  if (!isIpv4) {
    throw new Error(t('hardware.validation.shellyIpInvalid'));
  }
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString();
};

export const normalizeRuntimeAddress = (value: string): string => {
  const compact = value.trim().replace(/[:-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) {
    throw new Error(t('hardware.validation.sensorMacInvalid'));
  }

  const pairs = compact.match(/[0-9A-F]{2}/g);
  if (!pairs || pairs.length !== 6) {
    throw new Error(t('hardware.validation.sensorMacInvalid'));
  }
  return pairs.join(':');
};

export const formatSensorId = (
  _profileId: SensorProfileId,
  runtimeAddress: string
): string => `sensor-${runtimeAddress.replace(/:/g, '').toLowerCase()}`;

export const toNumberOrFallback = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

type Ipv4AddressParts = {
  networkPrefix: string;
  hostOctet: number;
};

type Ipv4ScanRange = {
  networkPrefix: string;
  startHostOctet: number;
  addressCount: number;
};

const parseIpv4ScanAddress = (value: string, label: string): Ipv4AddressParts => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(t('hardware.validation.scanAddressRequired', { label }));
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const host = withoutProtocol.split('/')[0] ?? '';
  const parts = host.split('.');

  if (parts.length !== 4) {
    throw new Error(t('hardware.validation.scanAddressInvalid', { label }));
  }

  const octets = parts.map((part) => Number(part));
  const isValid = octets.every(
    (octet, index) =>
      Number.isInteger(octet) && octet >= 0 && octet <= 255 && parts[index] !== ''
  );
  if (!isValid) {
    throw new Error(t('hardware.validation.scanAddressInvalid', { label }));
  }

  const hostOctet = octets[3];
  if (!hostOctet || hostOctet > 254) {
    throw new Error(t('hardware.validation.scanAddressHostInvalid', { label }));
  }

  return {
    networkPrefix: `${octets.slice(0, 3).join('.')}.`,
    hostOctet
  };
};

const parseIpv4ScanRange = (startValue: string, endValue: string): Ipv4ScanRange => {
  const start = parseIpv4ScanAddress(startValue, t('hardware.validation.scanStartLabel'));
  const end = parseIpv4ScanAddress(endValue, t('hardware.validation.scanEndLabel'));

  if (start.networkPrefix !== end.networkPrefix) {
    throw new Error(t('hardware.validation.scanRangeNetworkMismatch'));
  }
  if (start.hostOctet > end.hostOctet) {
    throw new Error(t('hardware.validation.scanRangeOrderInvalid'));
  }

  return {
    networkPrefix: start.networkPrefix,
    startHostOctet: start.hostOctet,
    addressCount: end.hostOctet - start.hostOctet + 1
  };
};

export const countIpv4RangeScanAddresses = (
  startValue: string,
  endValue: string
): number => parseIpv4ScanRange(startValue, endValue).addressCount;

export const createIpv4RangeScanUrls = (
  startValue: string,
  endValue: string
): string[] => {
  const range = parseIpv4ScanRange(startValue, endValue);
  return Array.from(
    { length: range.addressCount },
    (_, index) => `http://${range.networkPrefix}${range.startHostOctet + index}/`
  );
};
