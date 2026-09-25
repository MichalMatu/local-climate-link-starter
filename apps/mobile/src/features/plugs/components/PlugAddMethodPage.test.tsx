import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import { PlugAddMethodPage, type PlugAddMethodPageProps } from './PlugAddMethodPage.js';

const createProps = (): PlugAddMethodPageProps => ({
  manual: {
    name: 'Grow plug',
    url: 'http://192.168.0.20/',
    valid: true,
    nameError: undefined,
    urlError: undefined,
    pending: false,
    disabled: false,
    onNameChange: vi.fn(),
    onUrlChange: vi.fn(),
    onSubmit: vi.fn()
  },
  scan: {
    startInput: '192.168.0.1',
    endInput: '192.168.0.99',
    rangeError: null,
    active: false,
    success: false,
    stopped: false,
    results: [],
    checkPending: false,
    onStartInputChange: vi.fn(),
    onEndInputChange: vi.fn(),
    onStart: vi.fn(),
    onStop: vi.fn(),
    onAddResult: vi.fn()
  },
  bluetooth: {
    scanning: false,
    candidates: [],
    inspectingDeviceId: null,
    verifiedCandidate: null,
    error: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onInspect: vi.fn()
  }
});

const renderPage = (props: PlugAddMethodPageProps) =>
  render(
    <I18nProvider>
      <PlugAddMethodPage {...props} />
    </I18nProvider>
  );

describe('PlugAddMethodPage', () => {
  beforeEach(() => setLocalePreference('en'));
  afterEach(() => setLocalePreference('system'));

  it('starts on Wi-Fi and keeps existing network/manual choices inside it', () => {
    renderPage(createProps());

    expect(screen.getByRole('tab', { name: 'Wi-Fi' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Scan network' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Add manually' })).toBeInTheDocument();
  });

  it('switches to Bluetooth without rendering the Wi-Fi add surface', () => {
    const props = createProps();
    renderPage(props);

    fireEvent.click(screen.getByRole('tab', { name: 'Bluetooth' }));

    expect(screen.getByRole('tab', { name: 'Bluetooth' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.queryByRole('tab', { name: 'Scan network' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    expect(props.bluetooth.onStart).toHaveBeenCalledTimes(1);
  });

  it('stops the active transport scan before switching methods', () => {
    const props = createProps();
    props.scan.active = true;
    const { rerender } = renderPage(props);

    fireEvent.click(screen.getByRole('tab', { name: 'Bluetooth' }));
    expect(props.scan.onStop).toHaveBeenCalledTimes(1);

    props.bluetooth.scanning = true;
    rerender(
      <I18nProvider>
        <PlugAddMethodPage {...props} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Wi-Fi' }));
    expect(props.bluetooth.onStop).toHaveBeenCalledTimes(1);
  });
});
