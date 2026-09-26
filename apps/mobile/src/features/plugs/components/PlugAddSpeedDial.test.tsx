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

  it('keeps transport actions unavailable until the plus button expands them', () => {
    renderDial();

    expect(screen.getByRole('button', { name: 'Add plug' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toHaveAttribute(
      'tabindex',
      '-1'
    );
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Add plug' }));

    expect(screen.getByRole('button', { name: 'Add plug' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toHaveAttribute(
      'tabindex',
      '0'
    );
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toBeEnabled();
  });

  it('assigns the transport actions to perpendicular aligned slots', () => {
    renderDial();

    expect(screen.getByRole('button', { name: 'Wi-Fi' })).toHaveAttribute(
      'data-speed-dial-slot',
      'above'
    );
    expect(screen.getByRole('button', { name: 'Bluetooth' })).toHaveAttribute(
      'data-speed-dial-slot',
      'left'
    );
  });

  it('collapses when the expanded plus button is pressed again', () => {
    renderDial();
    const trigger = screen.getByRole('button', { name: 'Add plug' });

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses on pointer interaction outside the speed dial', () => {
    renderDial();
    const trigger = screen.getByRole('button', { name: 'Add plug' });

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses on Escape', () => {
    renderDial();
    const trigger = screen.getByRole('button', { name: 'Add plug' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
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
