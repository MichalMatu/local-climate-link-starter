import { DiagnosticRow, ToastViewport, type ToastMessage, type ToastTone } from '@lcl/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../../app/i18n.js';
import {
  formatDiagnosticNumber,
  mutationError,
  type HardwarePageProps
} from '../helpers.js';

type DiagnosticTime = NonNullable<
  HardwarePageProps['flow']['diagnosticSnapshot']
>['time'];

type DiagnosticPlug = NonNullable<
  HardwarePageProps['flow']['diagnosticSnapshot']
>['plug'];

const formatShellyTime = (time: DiagnosticTime | undefined): string =>
  time?.localTime ?? 'brak';

const formatTimeSyncState = (time: DiagnosticTime | undefined): string =>
  time?.isSynced ? 'OK' : 'brak synchronizacji';

const formatEpochMs = (value: number | null | undefined): string =>
  value == null
    ? 'brak'
    : new Date(value).toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

const formatEnergy = (value: number | null | undefined): string => {
  if (value == null) {
    return 'brak';
  }
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

const formatPlugRelay = (plug: DiagnosticPlug | undefined): string =>
  plug ? (plug.relayState ? 'ON' : 'OFF') : 'brak';

const reasonLabels: Record<string, string> = {
  ab: 'Powyżej progu',
  abh: 'Powyżej progu, czekam na potwierdzenie',
  b: 'Start bezpieczny OFF',
  bf: 'Nie udało się uruchomić BLE',
  bl: 'Poniżej progu',
  blh: 'Poniżej progu, czekam na potwierdzenie',
  bm: 'Brak danych BTHome',
  bo: 'Nieobsługiwany obiekt BTHome',
  bs: 'Za krótki pakiet BTHome',
  cv: 'Brak wartości do reguły',
  ib: 'W paśmie histerezy',
  mc: 'Blokada zbyt częstej zmiany',
  mx: 'Limit czasu ON',
  rl: 'Za słaby sygnał BLE',
  se: 'Błąd sterowania przekaźnikiem',
  st: 'Nie widzę czujnika',
  ta: 'Brak danych TP357',
  tm: 'Brak danych producenta TP357',
  tr: 'Odczyt TP357 poza zakresem',
  ts: 'Za krótki pakiet TP357'
};

const formatReason = (reason: string): string => {
  const label = reasonLabels[reason];
  return label ?? reason;
};

const dataStateLabels: Record<string, string> = {
  bm: 'Brak danych BTHome',
  bo: 'Nieobsługiwany obiekt BTHome',
  boot: 'Start',
  bs: 'Za krótki pakiet BTHome',
  cv: 'Czekam na pełny pomiar',
  ok: 'OK',
  pt: 'Pakiet pomocniczy',
  rl: 'Za słaby sygnał BLE',
  st: 'Nie widzę czujnika',
  ta: 'Brak danych TP357',
  tm: 'Brak danych producenta TP357',
  tr: 'Odczyt TP357 poza zakresem',
  ts: 'Za krótki pakiet TP357'
};

const formatDataState = (dataState: string): string =>
  dataStateLabels[dataState] ?? dataState;

export const DiagnosticsSetupPage = ({ flow }: HardwarePageProps) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(0);
  const diagnostics = flow.diagnosticSnapshot?.diagnostics;
  const shellyTime = flow.diagnosticSnapshot?.time;
  const script = flow.diagnosticSnapshot?.script;
  const plug = flow.diagnosticSnapshot?.plug;
  const thresholdUnit =
    flow.diagnosticSnapshot?.rule?.control.metric === 'humidity' ? '%' : '°C';
  const diagnosticSensorLabel =
    flow.diagnosticSnapshot?.sensor?.displayName ??
    flow.diagnosticSnapshot?.sensor?.runtimeAddress ??
    'brak';

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    toastIdRef.current += 1;
    const id = `diagnostics-toast-${toastIdRef.current}`;
    const toast: ToastMessage =
      detail === undefined ? { id, tone, title } : { id, tone, title, detail };
    setToasts((current) => [...current.slice(-2), toast]);
  }, []);

  useEffect(() => {
    if (!flow.diagnosticMutation.isError) {
      return;
    }

    pushToast(
      'warning',
      mutationError(flow.diagnosticMutation.error),
      t('hardware.diagnostics.empty')
    );
    flow.diagnosticMutation.reset();
  }, [flow.diagnosticMutation, pushToast]);

  return (
    <section className="demo-panel" aria-label={t('common.diagnostics')}>
      <label className="field">
        Gniazdko Shelly
        <span className="select-control">
          <select
            value={flow.diagnosticShellyId ?? ''}
            onChange={(event) => flow.setDiagnosticShellyId(event.currentTarget.value)}
          >
            <option value="" disabled>
              Wybierz gniazdko
            </option>
            {flow.shellyDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div className="action-row">
        <button
          className="secondary-action"
          type="button"
          aria-busy={flow.diagnosticMutation.isPending || undefined}
          disabled={flow.diagnosticShelly === null || flow.diagnosticMutation.isPending}
          title="Pobierz aktualny stan skryptu i przekaźnika z Shelly"
          onClick={() => flow.diagnosticMutation.mutate(undefined)}
        >
          {flow.diagnosticMutation.isPending ? 'Pobieram' : 'Odśwież diagnostykę'}
        </button>
      </div>

      {diagnostics && (
        <div className="status-stack">
          <DiagnosticRow label="Gniazdko" value={flow.diagnosticShelly?.name ?? 'brak'} />
          <DiagnosticRow
            label="Skrypt"
            value={script?.running ? 'działa' : 'brak potwierdzenia'}
            tone={script?.running ? 'normal' : 'warning'}
          />
          <DiagnosticRow label="Hash konfiguracji" value={script?.configHash ?? 'brak'} />
          <DiagnosticRow
            label="Przekaźnik Shelly"
            value={formatPlugRelay(plug)}
            tone={plug?.relayState ? 'warning' : 'normal'}
          />
          <DiagnosticRow label="Moc" value={formatDiagnosticNumber(plug?.powerW, ' W')} />
          <DiagnosticRow
            label="Napięcie"
            value={formatDiagnosticNumber(plug?.voltageV, ' V', 0)}
          />
          <DiagnosticRow
            label="Prąd"
            value={formatDiagnosticNumber(plug?.currentA, ' A', 2)}
          />
          <DiagnosticRow label="Energia" value={formatEnergy(plug?.energyWh)} />
          <DiagnosticRow
            label="Temp. gniazdka"
            value={formatDiagnosticNumber(plug?.deviceTemperatureC, '°C')}
          />
          <DiagnosticRow label="Termometr" value={diagnosticSensorLabel} />
          <DiagnosticRow label="Czas Shelly" value={formatShellyTime(shellyTime)} />
          <DiagnosticRow
            label="Zegar"
            value={formatTimeSyncState(shellyTime)}
            tone={shellyTime?.isSynced ? 'normal' : 'warning'}
          />
          <DiagnosticRow
            label="Ostatni pomiar"
            value={formatEpochMs(diagnostics.lastSeen)}
          />
          <DiagnosticRow
            label="Ostatni pakiet BLE"
            value={formatEpochMs(diagnostics.lastPacketSeen)}
          />
          <DiagnosticRow
            label="Temperatura"
            value={formatDiagnosticNumber(diagnostics.lastTemp, '°C')}
          />
          <DiagnosticRow
            label="Wilgotność"
            value={formatDiagnosticNumber(diagnostics.lastHumidity, '%')}
          />
          <DiagnosticRow
            label="Bateria"
            value={formatDiagnosticNumber(diagnostics.lastBattery, '%', 0)}
          />
          <DiagnosticRow
            label="RSSI"
            value={formatDiagnosticNumber(diagnostics.lastRssi, ' dBm', 0)}
          />
          <DiagnosticRow
            label="VPD"
            value={formatDiagnosticNumber(diagnostics.lastVpd, ' kPa', 2)}
          />
          <DiagnosticRow
            label="Próg ON"
            value={formatDiagnosticNumber(
              diagnostics.lastEffectiveOnThreshold,
              thresholdUnit
            )}
          />
          <DiagnosticRow
            label="Próg OFF"
            value={formatDiagnosticNumber(
              diagnostics.lastEffectiveOffThreshold,
              thresholdUnit
            )}
          />
          <DiagnosticRow label="Powód" value={formatReason(diagnostics.lastReason)} />
          <DiagnosticRow
            label="Dane BLE"
            value={formatDataState(diagnostics.dataState)}
          />
          <DiagnosticRow
            label="Przekaźnik reguły"
            value={diagnostics.relayState ? 'ON' : 'OFF'}
            tone={diagnostics.relayState ? 'warning' : 'normal'}
          />
        </div>
      )}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </section>
  );
};
