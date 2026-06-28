import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSetupDraftStore } from '../flows/demo/setupDraftStore.js';
import { DemoWizardScreen } from '../screens/DemoWizardScreen.js';

const renderDemo = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DemoWizardScreen />
    </QueryClientProvider>
  );
};

const click = (name: RegExp | string) =>
  fireEvent.click(screen.getByRole('button', { name }));

describe('DemoWizardScreen', () => {
  beforeEach(() => {
    useSetupDraftStore.setState({
      selectedSensorProfileId: 'xiaomi_lywsd03mmc_bthome_v2',
      onThreshold: 19,
      offThreshold: 20
    });
  });

  it('renders the start state', () => {
    renderDemo();

    expect(screen.getByText('Termostat bez huba.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj zestaw' })).toHaveAttribute(
      'title',
      'Rozpocznij konfigurację przykładowego zestawu'
    );
  });

  it('shows Matter blocked state during Shelly compatibility check', async () => {
    renderDemo();

    click('Dodaj zestaw');
    expect(screen.getByRole('button', { name: 'Skanuj demo' })).toHaveAttribute(
      'title',
      'Wczytaj przykładowe odczyty BLE'
    );
    click('Skanuj demo');
    await screen.findByText('Xiaomi LYWSD03MMC');
    click('Dodaj gniazdko');
    fireEvent.click(screen.getByLabelText('Scenariusz demo: Matter ON'));
    click('Sprawdź demo');

    const blockDialog = await screen.findByRole('dialog', {
      name: 'Instalacja zablokowana'
    });
    expect(
      within(blockDialog).getByText(
        'Matter jest włączony. Lokalny termostat wymaga Shelly Scripts.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('blokada')).toBeInTheDocument();
    expect(screen.getAllByText('włączony').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Ustaw próg' })).toBeDisabled();
  });

  it('updates the Polish rule summary with selected thresholds', async () => {
    renderDemo();

    click('Dodaj zestaw');
    click('Skanuj demo');
    await screen.findByText('Xiaomi LYWSD03MMC');
    click('Dodaj gniazdko');
    click('Sprawdź demo');
    await screen.findByText('Shelly Plug S Gen3');
    click('Ustaw próg');

    fireEvent.change(screen.getByLabelText('Włącz poniżej °C'), {
      target: { value: '18.5' }
    });
    fireEvent.change(screen.getByLabelText('Wyłącz powyżej °C'), {
      target: { value: '20.5' }
    });

    const summary = screen.getByText('Podsumowanie reguły').closest('article');
    expect(summary).not.toBeNull();
    expect(summary!).toHaveTextContent('Grzanie włączy się poniżej 18.5°C');
    expect(summary!).toHaveTextContent('wyłączy powyżej 20.5°C');
  });

  it('blocks script preview when heating thresholds are invalid', async () => {
    renderDemo();

    click('Dodaj zestaw');
    click('Skanuj demo');
    await screen.findByText('Xiaomi LYWSD03MMC');
    click('Dodaj gniazdko');
    click('Sprawdź demo');
    await screen.findByText('Shelly Plug S Gen3');
    click('Ustaw próg');

    const onThresholdInput = screen.getByLabelText('Włącz poniżej °C');
    const offThresholdInput = screen.getByLabelText('Wyłącz powyżej °C');

    fireEvent.change(onThresholdInput, {
      target: { value: '20' }
    });
    fireEvent.change(offThresholdInput, {
      target: { value: '19' }
    });

    const error = screen.getByText('Próg włączenia musi być niższy niż próg wyłączenia.');
    expect(error).toHaveClass('field__error');
    expect(onThresholdInput).toHaveAttribute('aria-invalid', 'true');
    expect(offThresholdInput).toHaveAttribute('aria-describedby', error.id);
    expect(screen.getByRole('button', { name: 'Pokaż skrypt' })).toBeDisabled();
  });

  it('completes the demo flow and confirms relay final OFF', async () => {
    renderDemo();

    click('Dodaj zestaw');
    click('Skanuj demo');
    await screen.findByText('Xiaomi LYWSD03MMC');
    click('Dodaj gniazdko');
    click('Sprawdź demo');
    await screen.findByText('Shelly Plug S Gen3');
    click('Ustaw próg');
    click('Pokaż skrypt');
    expect(screen.getByLabelText('Podgląd Shelly Script')).toHaveTextContent(
      'Switch.Set'
    );
    click('Zainstaluj demo');
    click('Wyślij skrypt demo');
    await screen.findByRole('button', { name: 'Przetestuj' });
    click('Przetestuj');

    await waitFor(() => {
      expect(screen.getByText('Gotowe — działa lokalnie')).toBeInTheDocument();
    });
    expect(screen.getByText('Test zakończony. Gniazdko jest OFF.')).toBeInTheDocument();
    expect(screen.getByText('Adres Shelly runtime')).toBeInTheDocument();
    expect(screen.getByText('AA:BB:CC:DD:EE:FF (symulowany)')).toBeInTheDocument();
  });
});
