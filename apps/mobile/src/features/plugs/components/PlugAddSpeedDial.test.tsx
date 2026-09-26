import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, setLocalePreference } from '../../../app/i18n.js';
import { PlugAddSpeedDial } from './PlugAddSpeedDial.js';

const renderDial = (onSelect = vi.fn()) => {
  render(
    <I18nProvider>
      <PlugAddSpeedDial onSelect={onSelect} />
    </I18nProvider>
  );
  return onSelect;
};

describe('PlugAddSpeedDial', () => {
  beforeEach(() => setLocalePreference('en'));
  afterEach(() => setLocalePreference('system'));

  it('keeps transport actions out of the tab order until the plus button expands them', () => {
    renderDial();

    expect(screen.getByRole('button', { name: 'Add plug' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toHaveAttribute(
      'tabindex',
      '-1'
    );
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toHaveAttribute(
      'tabindex',
      '-1'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add plug' }));

    expect(screen.getByRole('button', { name: 'Add plug' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toHaveAttribute(
      'tabindex',
      '0'
    );
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toHaveAttribute(
      'tabindex',
      '0'
    );
  });

  it('assigns symmetric radial slots to the two transport actions', () => {
    renderDial();

    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toHaveAttribute(
      'data-radial-slot',
      'left'
    );
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toHaveAttribute(
      'data-radial-slot',
      'right'
    );
  });

  it.each([
    ['Wi-Fi', 'wifi'],
    ['Bluetooth', 'bluetooth']
  ] as const)('selects %s as an independent add transport', (label, transport) => {
    const onSelect = renderDial();
    fireEvent.click(screen.getByRole('button', { name: 'Add plug' }));
    fireEvent.click(screen.getByRole('button', { name: label }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(transport);
    expect(screen.getByRole('button', { name: 'Add plug' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});
