import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import type { PlugInformation } from '../data/plugInformation.js';
import { PlugInfoPanel } from './PlugInfoPanel.js';

const information = {
  deviceInfo: {
    id: 'shellyplugsg3-demo',
    model: 'S3PL-00112EU',
    gen: 3,
    firmwareId: '1.7.5'
  },
  status: {
    relayOn: false,
    telemetry: {
      currentA: 0.12,
      deviceTemperatureC: 31.4,
      wifiRssiDbm: -55
    },
    clock: {
      uptimeSec: 3600,
      localTime: '12:34',
      timeSynced: true,
      lastSyncUnixTimeSec: null
    },
    matterEnabled: false
  }
} as PlugInformation;

describe('PlugInfoPanel', () => {
  beforeEach(() => setLocalePreference('en'));
  afterEach(() => setLocalePreference('system'));

  it('shows BLE locator metadata instead of Wi-Fi-only rows', () => {
    render(
      <I18nProvider>
        <PlugInfoPanel
          connection={{
            transport: 'bluetooth',
            bleDeviceId: 'E4:B0:63:E3:E2:9A',
            advertisementName: 'ShellyPlugSG3-E4B063E3E298'
          }}
          information={information}
          showResourceRows={false}
        />
      </I18nProvider>
    );

    expect(
      screen.getByText('E4:B0:63:E3:E2:9A · ShellyPlugSG3-E4B063E3E298')
    ).toBeVisible();
    expect(screen.queryByText('IP address')).not.toBeInTheDocument();
    expect(screen.queryByText('Wi-Fi RSSI')).not.toBeInTheDocument();
    expect(screen.queryByText('Device RAM free')).not.toBeInTheDocument();
  });
});
