import { IconDotsVertical, IconTemperature } from '@tabler/icons-react';
import { useTranslation } from '../../app/i18n.js';
import type { SavedPlug } from '../../flows/devices/plugs/model.js';
import { usePlugRuntimeQuery } from '../../flows/devices/plugs/usePlugManagementFlow.js';
import { useSensorStore } from '../../flows/registry/devicesAndRules.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import { useClimateRuleDiagnostics } from '../../flows/rules/useClimateRuleDiagnostics.js';
import { useRuleRuntime } from '../../flows/rules/useRuleRuntime.js';
import {
  ruleContextKey,
  ruleScheduleSummary,
  ruleThresholdSummary
} from '../rules/rulePresentation.js';
import {
  formatPlugClock,
  formatPlugEnergy,
  formatPlugPower,
  formatPlugVoltage
} from './plugPresentation.js';

const formatMetric = (
  value: number | null | undefined,
  unit: string,
  fractionDigits = 1
) => (typeof value === 'number' ? `${value.toFixed(fractionDigits)}${unit}` : '—');

export const SavedPlugCard = ({
  plug,
  rules,
  relayBusy,
  onOpen,
  onOpenRule,
  onSetRelay
}: {
  plug: SavedPlug;
  rules: readonly AutomationRule[];
  relayBusy: boolean;
  onOpen(): void;
  onOpenRule(ruleId: string): void;
  onSetRelay(on: boolean): void;
}) => {
  const { t } = useTranslation();
  const runtime = usePlugRuntimeQuery(plug, rules);
  const plugSnapshot = runtime.data?.ok ? runtime.data.value : null;
  const telemetry = plugSnapshot?.telemetry;
  const owner = rules.find((rule) => rule.plugId === plug.id && rule.relayId === 0);
  const climateRule = owner?.kind === 'climate' ? owner : null;
  const sensor = useSensorStore((state) =>
    climateRule
      ? state.items.find((candidate) => candidate.id === climateRule.sensorId)
      : undefined
  );
  const diagnostics = useClimateRuleDiagnostics(climateRule, plug);
  const ruleRuntime = useRuleRuntime(owner?.id ?? '');
  const ruleSnapshot = ruleRuntime.runtime.data;
  const climateRuntime =
    climateRule &&
    ruleSnapshot &&
    'mode' in ruleSnapshot &&
    'scriptMatch' in ruleSnapshot &&
    'modeSupported' in ruleSnapshot
      ? ruleSnapshot
      : null;
  const diagnosticsSnapshot = diagnostics.data;
  const relayOn =
    ruleSnapshot && 'relayOn' in ruleSnapshot
      ? ruleSnapshot.relayOn
      : plugSnapshot?.relayOn;
  const climateVerified = Boolean(
    climateRule?.deployment &&
    climateRule.deployment.safetyTest.status === 'verified' &&
    climateRuntime?.scriptMatch === 'matched' &&
    climateRuntime.modeSupported
  );
  const auto = climateVerified && climateRuntime?.mode === 'auto';
  const manual = climateVerified && climateRuntime?.mode === 'manual';
  const actionBusy = relayBusy || ruleRuntime.action.isPending;
  const threshold = owner ? ruleThresholdSummary(owner) : null;
  const schedule = owner
    ? ruleScheduleSummary(
        owner.kind === 'climate' ? owner.schedule : owner.config.schedule
      )
    : null;

  return (
    <article
      className="saved-list__item shelly-saved-card plug-operational-card"
      aria-busy={runtime.isFetching || ruleRuntime.runtime.isFetching || undefined}
    >
      <div className="shelly-card-header">
        <div className="plug-operational-card__identity">
          <h3>{plug.name}</h3>
          <p>{owner ? t(ruleContextKey(owner)) : t('common.missing')}</p>
        </div>
        <button
          className="automation-card__menu"
          type="button"
          aria-label={`${t('hardware.shelly.settings')}: ${plug.name}`}
          title={t('hardware.shelly.settings')}
          onClick={onOpen}
        >
          <IconDotsVertical className="automation-card__menu-icon" aria-hidden="true" />
        </button>
      </div>

      <div className="shelly-state-strip plug-operational-card__state">
        <span>
          {t('hardware.metrics.relay')}{' '}
          <strong>{typeof relayOn === 'boolean' ? (relayOn ? 'ON' : 'OFF') : '—'}</strong>
        </span>
        <span>
          {t('time.owner')} <strong>{owner?.name ?? '—'}</strong>
        </span>
      </div>

      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(telemetry?.powerW, t)}</span>
        <span>{formatPlugVoltage(telemetry?.voltageV, t)}</span>
        <span>{formatPlugEnergy(telemetry?.energyWh, t)}</span>
        <span>{formatPlugClock(plugSnapshot?.clock, t)}</span>
      </div>

      {climateRule && (
        <section
          className="plug-operational-card__climate"
          aria-label={t('detail.automation')}
        >
          <div className="plug-operational-card__sensor-heading">
            <IconTemperature aria-hidden="true" />
            <span>{sensor?.name ?? t('common.missing')}</span>
          </div>
          <div className="plug-operational-card__climate-metrics">
            <div>
              <span>{t('dashboard.temperature')}</span>
              <strong>
                {formatMetric(diagnosticsSnapshot?.diagnostics.lastTemp, '°C')}
              </strong>
            </div>
            <div>
              <span>{t('dashboard.humidity')}</span>
              <strong>
                {formatMetric(diagnosticsSnapshot?.diagnostics.lastHumidity, '%')}
              </strong>
            </div>
            <div>
              <span>{t('dashboard.vpd')}</span>
              <strong>
                {formatMetric(diagnosticsSnapshot?.diagnostics.lastVpd, ' kPa', 2)}
              </strong>
            </div>
          </div>
          <div className="plug-operational-card__rule-summary">
            {threshold && (
              <span>
                {t('dashboard.thresholds')} <strong>{threshold}</strong>
              </span>
            )}
            {schedule && (
              <span>
                {t('time.scheduleSummary')} <strong>{schedule}</strong>
              </span>
            )}
          </div>
          <div
            className="automation-control-group plug-operational-card__mode-control"
            role="group"
            aria-label={t('detail.automation')}
          >
            <button
              className="automation-control-button"
              type="button"
              aria-pressed={auto}
              disabled={actionBusy || !climateVerified}
              onClick={() => {
                if (!auto) ruleRuntime.action.mutate('resume');
              }}
            >
              AUTO
            </button>
            <button
              className="automation-control-button"
              type="button"
              aria-pressed={manual}
              disabled={actionBusy || !climateVerified}
              onClick={() => {
                if (!manual) ruleRuntime.action.mutate('pause');
              }}
            >
              MANUAL
            </button>
          </div>
        </section>
      )}

      {owner?.kind === 'time' && (
        <section className="plug-operational-card__time-rule">
          <span>{t('time.scheduleSummary')}</span>
          <strong>{schedule ?? t('common.missing')}</strong>
        </section>
      )}

      <div
        className="automation-relay-actions plug-operational-card__relay-actions"
        role="group"
        aria-label={t('dashboard.output')}
      >
        <button
          className="automation-relay-button"
          type="button"
          aria-pressed={relayOn === true}
          disabled={
            actionBusy ||
            (climateRule ? !manual : Boolean(owner)) ||
            (!owner && runtime.isFetching)
          }
          onClick={() => {
            if (climateRule) ruleRuntime.action.mutate('relay-on');
            else onSetRelay(true);
          }}
        >
          ON
        </button>
        <button
          className="automation-relay-button"
          type="button"
          aria-pressed={relayOn === false}
          disabled={
            actionBusy ||
            (climateRule ? !manual : Boolean(owner)) ||
            (!owner && runtime.isFetching)
          }
          onClick={() => {
            if (climateRule) ruleRuntime.action.mutate('relay-off');
            else onSetRelay(false);
          }}
        >
          OFF
        </button>
      </div>

      {owner && (
        <button
          className="plug-operational-card__rule-link"
          type="button"
          onClick={() => onOpenRule(owner.id)}
        >
          {owner.name}
        </button>
      )}
    </article>
  );
};
