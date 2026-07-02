import { DiagnosticRow, ToastViewport, type ToastMessage, type ToastTone } from '@lcl/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useTranslation,
  type Translate,
  type TranslationKey
} from '../../../app/i18n.js';
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

const formatShellyTime = (
  time: DiagnosticTime | undefined,
  missingLabel: string
): string => time?.localTime ?? missingLabel;

const formatTimeSyncState = (time: DiagnosticTime | undefined, t: Translate): string =>
  time?.isSynced ? 'OK' : t('hardware.status.unsynced');

const formatEpochMs = (
  value: number | null | undefined,
  locale: string,
  missingLabel: string
): string =>
  value == null
    ? missingLabel
    : new Date(value).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

const formatEnergy = (value: number | null | undefined, missingLabel: string): string => {
  if (value == null) {
    return missingLabel;
  }
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;
};

const formatPlugRelay = (
  plug: DiagnosticPlug | undefined,
  missingLabel: string
): string => (plug ? (plug.relayState ? 'ON' : 'OFF') : missingLabel);

const diagnosticReasonKeys = new Set([
  'ab',
  'abh',
  'b',
  'bf',
  'bl',
  'blh',
  'bm',
  'bo',
  'boot',
  'bs',
  'cv',
  'ib',
  'mc',
  'mx',
  'ok',
  'pt',
  'rl',
  'se',
  'st',
  'ta',
  'tm',
  'tr',
  'ts'
]);

const formatReason = (reason: string, t: Translate): string =>
  diagnosticReasonKeys.has(reason)
    ? t(`hardware.diagnosticsReason.${reason}` as TranslationKey)
    : reason;

export const DiagnosticsSetupPage = ({ flow }: HardwarePageProps) => {
  const { locale, t } = useTranslation();
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
    t('common.missing');

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
  }, [flow.diagnosticMutation, pushToast, t]);

  return (
    <section className="demo-panel" aria-label={t('common.diagnostics')}>
      <label className="field">
        {t('hardware.rule.selectedShelly')}
        <span className="select-control">
          <select
            value={flow.diagnosticShellyId ?? ''}
            onChange={(event) => flow.setDiagnosticShellyId(event.currentTarget.value)}
          >
            <option value="" disabled>
              {t('hardware.rule.noShellySelected')}
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
          title={t('hardware.diagnostics.actionRefreshTitle')}
          onClick={() => flow.diagnosticMutation.mutate(undefined)}
        >
          {flow.diagnosticMutation.isPending
            ? t('hardware.diagnostics.fetching')
            : t('hardware.diagnostics.actionRefresh')}
        </button>
      </div>

      {diagnostics && (
        <div className="status-stack">
          <DiagnosticRow
            label={t('hardware.rule.selectedShelly')}
            value={flow.diagnosticShelly?.name ?? t('common.missing')}
          />
          <DiagnosticRow
            label={t('hardware.rule.script')}
            value={
              script?.running
                ? t('hardware.status.running')
                : t('hardware.diagnostics.scriptMissingConfirm')
            }
            tone={script?.running ? 'normal' : 'warning'}
          />
          <DiagnosticRow
            label={t('hardware.metrics.configHash')}
            value={script?.configHash ?? t('common.missing')}
          />
          <DiagnosticRow
            label={t('hardware.metrics.shellyRelay')}
            value={formatPlugRelay(plug, t('common.missing'))}
            tone={plug?.relayState ? 'warning' : 'normal'}
          />
          <DiagnosticRow
            label={t('hardware.metrics.power')}
            value={formatDiagnosticNumber(plug?.powerW, ' W')}
          />
          <DiagnosticRow
            label={t('hardware.metrics.voltage')}
            value={formatDiagnosticNumber(plug?.voltageV, ' V', 0)}
          />
          <DiagnosticRow
            label={t('hardware.metrics.current')}
            value={formatDiagnosticNumber(plug?.currentA, ' A', 2)}
          />
          <DiagnosticRow
            label={t('hardware.metrics.energy')}
            value={formatEnergy(plug?.energyWh, t('common.missing'))}
          />
          <DiagnosticRow
            label={t('hardware.metrics.plugTemperature')}
            value={formatDiagnosticNumber(plug?.deviceTemperatureC, '°C')}
          />
          <DiagnosticRow
            label={t('hardware.metrics.thermometer')}
            value={diagnosticSensorLabel}
          />
          <DiagnosticRow
            label={t('hardware.metrics.clockShelly')}
            value={formatShellyTime(shellyTime, t('common.missing'))}
          />
          <DiagnosticRow
            label={t('hardware.shelly.clockSync')}
            value={formatTimeSyncState(shellyTime, t)}
            tone={shellyTime?.isSynced ? 'normal' : 'warning'}
          />
          <DiagnosticRow
            label={t('hardware.metrics.lastMeasurement')}
            value={formatEpochMs(diagnostics.lastSeen, locale, t('common.missing'))}
          />
          <DiagnosticRow
            label={t('hardware.metrics.lastBlePacket')}
            value={formatEpochMs(diagnostics.lastPacketSeen, locale, t('common.missing'))}
          />
          <DiagnosticRow
            label={t('hardware.metrics.temperature')}
            value={formatDiagnosticNumber(diagnostics.lastTemp, '°C')}
          />
          <DiagnosticRow
            label={t('hardware.metrics.humidity')}
            value={formatDiagnosticNumber(diagnostics.lastHumidity, '%')}
          />
          <DiagnosticRow
            label={t('hardware.metrics.battery')}
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
            label={t('hardware.metrics.thresholdOn')}
            value={formatDiagnosticNumber(
              diagnostics.lastEffectiveOnThreshold,
              thresholdUnit
            )}
          />
          <DiagnosticRow
            label={t('hardware.metrics.thresholdOff')}
            value={formatDiagnosticNumber(
              diagnostics.lastEffectiveOffThreshold,
              thresholdUnit
            )}
          />
          <DiagnosticRow
            label={t('hardware.metrics.reason')}
            value={formatReason(diagnostics.lastReason, t)}
          />
          <DiagnosticRow
            label={t('hardware.metrics.dataBle')}
            value={formatReason(diagnostics.dataState, t)}
          />
          <DiagnosticRow
            label={t('hardware.metrics.relayRule')}
            value={diagnostics.relayState ? 'ON' : 'OFF'}
            tone={diagnostics.relayState ? 'warning' : 'normal'}
          />
        </div>
      )}
      <ToastViewport
        dismissLabel={t('toast.dismiss')}
        label={t('toast.regionLabel')}
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </section>
  );
};
