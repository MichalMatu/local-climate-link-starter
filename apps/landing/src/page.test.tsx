import { render, screen } from '@testing-library/react';

import { LandingPage } from './page';

describe('LandingPage', () => {
  it('shows the product promise and primary beta action', () => {
    render(<LandingPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Termostat bez huba' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pobierz betę Android' })).toHaveAttribute(
      'href',
      '#beta'
    );
  });

  it('keeps the supported MVP hardware visible', () => {
    render(<LandingPage />);

    expect(screen.getByText('Shelly Plug S Gen3')).toBeInTheDocument();
    expect(screen.getByText('Xiaomi LYWSD03MMC / PVVX')).toBeInTheDocument();
    expect(screen.getByText('TP357 custom BLE')).toBeInTheDocument();
  });
});
