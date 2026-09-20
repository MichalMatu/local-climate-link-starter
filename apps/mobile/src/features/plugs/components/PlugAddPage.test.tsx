import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import { PlugAddPage, type PlugAddPageProps } from './PlugAddPage.js';

const createProps = (): PlugAddPageProps => ({
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
  }
});

const renderPage = (props: PlugAddPageProps) =>
  render(
    <I18nProvider>
      <PlugAddPage {...props} />
    </I18nProvider>
  );

describe('PlugAddPage', () => {
  beforeEach(() => setLocalePreference('en'));
  afterEach(() => setLocalePreference('system'));

  it('owns scan/manual tab state and stops an active scan before leaving it', () => {
    const props = createProps();
    props.scan.active = true;
    renderPage(props);

    fireEvent.click(screen.getByRole('tab', { name: 'Add manually' }));

    expect(props.scan.onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Plug name')).toHaveValue('Grow plug');
  });

  it('keeps manual validation local and submits only valid input', () => {
    const props = createProps();
    props.manual.valid = false;
    props.manual.nameError = 'Enter a device name.';
    renderPage(props);

    fireEvent.click(screen.getByRole('tab', { name: 'Add manually' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a device name.')).toBeInTheDocument();
    expect(props.manual.onSubmit).not.toHaveBeenCalled();
  });

  it('adds a discovered Plug with the editable display name', () => {
    const props = createProps();
    props.scan.results = [
      {
        baseUrl: 'http://192.168.0.31/',
        model: 'S3PL-00112EU',
        generation: 3,
        saved: false,
        adding: false
      }
    ];
    renderPage(props);

    const name = screen.getByLabelText('Plug name: http://192.168.0.31/');
    fireEvent.change(name, { target: { value: 'Tent plug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add: http://192.168.0.31/' }));

    expect(props.scan.onAddResult).toHaveBeenCalledWith(
      'http://192.168.0.31/',
      'Tent plug'
    );
  });
});
