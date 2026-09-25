import { buildVerifiedPlugBleCandidate } from './plugBleOnboarding.js';

describe('BLE Plug onboarding identity', () => {
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
      }
    });

    expect(candidate).toEqual({
      bleDeviceId: 'E4:B0:63:E3:E2:9A',
      advertisementName: 'ShellyPlugSG3-E4B063E3E298',
      rssi: -43,
      physicalId: 'shellyplugsg3-e4b063e3e298',
      model: 'S3PL-00112EU',
      generation: 3,
      firmwareId: '1.2.3-matter22',
      matterEnabled: true
    });
  });

  it('refuses to create a verified candidate without Shelly physical identity', () => {
    expect(() =>
      buildVerifiedPlugBleCandidate({
        bleDeviceId: 'temporary-handle',
        advertisementName: 'ShellyPlugSG3',
        rssi: null,
        deviceInfo: { model: 'S3PL-00112EU', gen: 3 }
      })
    ).toThrow('Shelly BLE identity is missing.');
  });
});
