import {
  normalizeShellyDeviceId,
  type ShellyDeviceInfo,
  type ShellyWifiReadResult
} from '@lcl/shelly-client';

export type PlugBleAdvertisement = {
  deviceId: string;
  name: string;
  rssi: number | null;
};

export type PlugBleNetworkState = 'needs-wifi' | 'has-wifi';

export type PlugBleNetworkSnapshot = {
  state: PlugBleNetworkState;
  configuredSsids: string[];
  connectionStatus: ShellyWifiReadResult['status']['status'];
  connectedSsid: string | null;
  stationIp: string | null;
};

export type VerifiedPlugBleCandidate = {
  bleDeviceId: string;
  advertisementName: string;
  rssi: number | null;
  physicalId: string;
  model: string;
  generation: number;
  firmwareId: string | null;
  matterEnabled: boolean | null;
  network: PlugBleNetworkSnapshot;
};

const configuredSsid = (value: string | null | undefined): string | null => {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
};

export const classifyPlugBleNetwork = (
  wifi: ShellyWifiReadResult
): PlugBleNetworkSnapshot => {
  const configuredSsids = [wifi.config.sta, wifi.config.sta1]
    .flatMap((station) => {
      const ssid = configuredSsid(station?.ssid);
      return ssid ? [ssid] : [];
    })
    .filter((ssid, index, values) => values.indexOf(ssid) === index);

  return {
    state: configuredSsids.length > 0 ? 'has-wifi' : 'needs-wifi',
    configuredSsids,
    connectionStatus: wifi.status.status,
    connectedSsid: configuredSsid(wifi.status.ssid),
    stationIp: configuredSsid(wifi.status.sta_ip)
  };
};

export const buildVerifiedPlugBleCandidate = (input: {
  bleDeviceId: string;
  advertisementName: string;
  rssi: number | null;
  deviceInfo: ShellyDeviceInfo;
  wifi: ShellyWifiReadResult;
}): VerifiedPlugBleCandidate => {
  const physicalId = normalizeShellyDeviceId(input.deviceInfo.id ?? '');
  if (!physicalId) {
    throw new Error('Shelly BLE identity is missing.');
  }

  return {
    bleDeviceId: input.bleDeviceId,
    advertisementName: input.advertisementName,
    rssi: input.rssi,
    physicalId,
    model: input.deviceInfo.model,
    generation: input.deviceInfo.gen,
    firmwareId: input.deviceInfo.firmwareId ?? null,
    matterEnabled: input.deviceInfo.matterEnabled ?? null,
    network: classifyPlugBleNetwork(input.wifi)
  };
};
