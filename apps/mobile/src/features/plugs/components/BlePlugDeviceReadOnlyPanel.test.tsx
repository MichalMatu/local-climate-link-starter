import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import { BlePlugDeviceReadOnlyPanel } from './BlePlugDeviceReadOnlyPanel.js';

describe('BlePlugDeviceReadOnlyPanel', () => {
  beforeEach(() => setLocalePreference('en'));
  afterEach(() => setLocalePreference('system'));

  it('renders compact read-only LED and physical-button state without mutation controls', () => {
    render(
      <I18nProvider>
        <BlePlugDeviceReadOnlyPanel
          settings={{
            supported: true,
            config: {
              leds: {
                mode: 'switch',
                colors: {
                  'switch:0': {
                    on: { rgb: [0, 100, 0], brightness: 100 },
                    off: { rgb: [100, 0, 0], brightness: 100 }
                  }
                },
                night_mode: {
                  enable: true,
                  brightness: 10,
                  active_between: ['22:00', '06:00']
                }
              },
              controls: { 'switch:0': { in_mode: 'momentary' } }
            },
            capabilities: {
              switchColors: true,
              powerBrightness: false,
              nightMode: true
            },
            controlCapabilities: { buttonInputMode: true }
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Show ON/OFF')).toBeVisible();
    expect(screen.getByText('enabled · 10% · 22:00–06:00')).toBeVisible();
    expect(screen.getByText('Controls relay')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
