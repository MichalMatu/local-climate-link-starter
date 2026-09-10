import { type ToastTone } from '@lcl/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../app/i18n.js';
import { RefreshIconButton } from '../components/RefreshIconButton.js';
import {
  applyInstalledShellyLedPreset,
  installedShellyLedSettingsQueryKey,
  readInstalledShellyLedSettings,
  type InstalledShellyLedPreset
} from '../flows/installations/deviceLed.js';
import type { InstalledAutomation } from '../flows/installations/model.js';
import { deviceLedCopy } from '../app/locales/deviceLed.js';

type ShellyLedSettingsCardProps = {
  installation: InstalledAutomation;
  onFeedback(tone: ToastTone, title: string): void;
};

const formatLedColor = ({
  rgb,
  brightness
}: {
  rgb: [number, number, number] | null;
  brightness: number;
}) => `${rgb ? `RGB ${rgb.join('/')}` : 'RGB —'} · ${Math.round(brightness)}%`;

export const ShellyLedSettingsCard = ({
  installation,
  onFeedback
}: ShellyLedSettingsCardProps) => {
  const { locale, t } = useTranslation();
  const copy = deviceLedCopy[locale];
  const queryClient = useQueryClient();
  const queryKey = installedShellyLedSettingsQueryKey(installation);
  const settingsQuery = useQuery({
    queryKey,
    queryFn: () => readInstalledShellyLedSettings(installation),
    retry: false,
    refetchOnWindowFocus: false
  });
  const presetMutation = useMutation({
    mutationFn: (preset: InstalledShellyLedPreset) =>
      applyInstalledShellyLedPreset(installation, preset),
    onSuccess: (settings, preset) => {
      queryClient.setQueryData(queryKey, settings);
      onFeedback(
        'ok',
        preset === 'relay-state' ? copy.relayPresetSuccess : copy.offSuccess
      );
    },
    onError: () => onFeedback('warning', copy.actionFailed)
  });

  const settings = settingsQuery.data;
  const config = settings?.supported ? settings.config : undefined;
  const mode = config?.leds.mode;
  const switchColors = config?.leds.colors?.['switch:0'];
  const powerBrightness = config?.leds.colors?.power?.brightness;
  const modeLabel =
    mode === 'power'
      ? copy.power
      : mode === 'switch'
        ? copy.switch
        : mode === 'off'
          ? copy.off
          : '—';

  return (
    <article className="automation-card installation-detail-device-led">
      <div className="installation-section-heading">
        <div>
          <p className="automation-card__eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
        <RefreshIconButton
          busy={settingsQuery.isFetching}
          label={t('common.refresh')}
          onRefresh={() => void settingsQuery.refetch()}
        />
      </div>

      <p className="time-schedule-note">{copy.description}</p>

      {settingsQuery.isPending ? (
        <p className="time-schedule-note">{copy.loading}</p>
      ) : settingsQuery.isError ? (
        <p className="installation-detail-note">{copy.unavailable}</p>
      ) : settings && !settings.supported ? (
        <p className="time-schedule-note">{copy.unsupported}</p>
      ) : config ? (
        <>
          <dl className="automation-summary installation-detail-summary">
            <div>
              <dt>{copy.currentMode}</dt>
              <dd>{modeLabel}</dd>
            </div>
            {mode === 'switch' && switchColors ? (
              <>
                <div>
                  <dt>{copy.onState}</dt>
                  <dd>{formatLedColor(switchColors.on)}</dd>
                </div>
                <div>
                  <dt>{copy.offState}</dt>
                  <dd>{formatLedColor(switchColors.off)}</dd>
                </div>
              </>
            ) : null}
            {mode === 'power' && powerBrightness !== undefined ? (
              <div>
                <dt>{copy.powerBrightness}</dt>
                <dd>{Math.round(powerBrightness)}%</dd>
              </div>
            ) : null}
          </dl>

          <p className="time-schedule-note">{copy.relayPresetHint}</p>

          <div className="installation-detail-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={presetMutation.isPending}
              onClick={() => presetMutation.mutate('relay-state')}
            >
              {copy.relayPreset}
            </button>
            <button
              className="secondary-action"
              type="button"
              disabled={presetMutation.isPending || mode === 'off'}
              onClick={() => presetMutation.mutate('off')}
            >
              {copy.turnOff}
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
};
