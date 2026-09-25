import {
  buildVerifiedPlugBleCandidate,
  classifyPlugBleNetwork
} from './plugBleOnboarding.js';

const wifi = (
  patch: {
    staSsid?: string | null;
    sta1Ssid?: string | null;
    status?: 'disconnected' | 'connecting' | 'connected' | 'got ip';
    connectedSsid?: string | null;
    stationIp?: string | null;
  } = {}
) => ({
  config: {
    sta: { ssid: patch.staSsid ?? null, enable: Boolean(patch.staSsid) },
    sta1: { ssid: patch.sta1Ssid ?? null, enable: Boolean(patch.sta1Ssid) }
  },
  status: {
    status: patch.status ?? 'disconnected',
    ssid: patch.connectedSsid ?? null,
    sta_ip: patch.stationIp ?? null
  }
});

describe('BLE Plug onboarding classification', () => {
  it('marks a device without stored station SSIDs as needing Wi-Fi', () => {
    expect(classifyPlugBleNetwork(wifi())).toEqual({
      state: 'needs-wifi',
      configuredSsids: [],
      connectionStatus: 'disconnected',
      connectedSsid: null,
      stationIp: null
    });
  });

  it('marks a disconnected device with stored credentials as having Wi-Fi', () => {
    expect(
      classifyPlugBleNetwork(
        wifi({ staSsid: 'Home', status: 'disconnected', connectedSsid: null })
      )
    ).toMatchObject({
      state: 'has-wifi',
      configuredSsids: ['Home'],
      connectionStatus: 'disconnected'
    });
  });

  it('deduplicates configured station SSIDs and exposes live IP state', () => {
    expect(
      classifyPlugBleNetwork(
        wifi({
          staSsid: 'Home',
          sta1Ssid: 'Home',
          status: 'got ip',
          connectedSsid: 'Home',
          stationIp: '192.168.0.44'
        })
      )
    ).toEqual({
      state: 'has-wifi',
      configuredSsids: ['Home'],
      connectionStatus: 'got ip',
      connectedSsid: 'Home',
      stationIp: '192.168.0.44'
    });
  });

  it('builds a verified candidate around canonical physical identity', () => {
    const candidate = buildVerifiedPlugBleCandidate({
      bleDeviceId: 'E4:B0:63:E3:E2:9A',
      advertisementName: 'ShellyPlugSG3-E4B063E3E298',
      rssi: -43,
      deviceInfo: {
        id: ' ShellyPlugSG3-E4B063E3E298 ',
        model: 'S3PL-00112EU',
        gen: 3,
        firmwareId: '1.2.3-matter22',
        matterEnabled: true
      },
      wifi: wifi()
    });

    expect(candidate).toMatchObject({
      bleDeviceId: 'E4:B0:63:E3:E2:9A',
      physicalId: 'shellyplugsg3-e4b063e3e298',
      model: 'S3PL-00112EU',
      generation: 3,
      firmwareId: '1.2.3-matter22',
      matterEnabled: true,
      network: { state: 'needs-wifi' }
    });
  });

  it('refuses to create a verified candidate without Shelly physical identity', () => {
    expect(() =>
      buildVerifiedPlugBleCandidate({
        bleDeviceId: 'temporary-handle',
        advertisementName: 'ShellyPlugSG3',
        rssi: null,
        deviceInfo: { model: 'S3PL-00112EU', gen: 3 },
        wifi: wifi()
      })
    ).toThrow('Shelly BLE identity is missing.');
  });
});
