import { IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../app/i18n.js';
import type { PlugRuntimeSnapshot } from '../../flows/devices/plugs/inventory.js';
import type { SavedPlug } from '../../flows/devices/plugs/model.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import {
  formatPlugClock,
  formatPlugEnergy,
  formatPlugPower,
  formatPlugVoltage
} from './plugPresentation.js';

type PlugDetailContentProps = {
  plug: SavedPlug;
  snapshot: PlugRuntimeSnapshot | null;
  rules: readonly AutomationRule[];
  canControlRelay: boolean;
  busy: boolean;
  runtimeLoading: boolean;
  runtimeFailed: boolean;
  onRefresh(): void;
  onRename(name: string): Promise<boolean>;
  onSetRelay(on: boolean): Promise<void>;
  onOpenRule(ruleId: string): void;
  onDeleteOrphan(scriptId: number): void;
  onRequestDelete(): void;
};

export const PlugDetailContent = ({
  plug,
  snapshot,
  rules,
  canControlRelay,
  busy,
  runtimeLoading,
  runtimeFailed,
  onRefresh,
  onRename,
  onSetRelay,
  onOpenRule,
  onDeleteOrphan,
  onRequestDelete
}: PlugDetailContentProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(plug.name);
  const plugRules = rules.filter((rule) => rule.plugId === plug.id && rule.relayId === 0);

  useEffect(() => setName(plug.name), [plug.id, plug.name]);

  return (
    <div className="plug-detail-card">
      <div className="plug-detail-card__name-row">
        <label className="field plug-detail-card__name-field">
          {t('hardware.shelly.deviceNameLabel')}
          <input
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <button
          className="secondary-action plug-detail-card__save-name"
          type="button"
          disabled={busy || !name.trim() || name.trim() === plug.name}
          onClick={async () => {
            if (await onRename(name.trim())) setName(name.trim());
          }}
        >
          {t('common.apply')}
        </button>
      </div>

      <dl className="plug-detail-card__identity">
        <div>
          <dt>{t('common.address')}</dt>
          <dd>{plug.baseUrl}</dd>
        </div>
        <div>
          <dt>{t('common.model')}</dt>
          <dd>{plug.model}</dd>
        </div>
      </dl>

      <div
        className="shelly-metrics-strip plug-detail-card__metrics"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(snapshot?.telemetry.powerW, t)}</span>
        <span>{formatPlugVoltage(snapshot?.telemetry.voltageV, t)}</span>
        <span>{formatPlugEnergy(snapshot?.telemetry.energyWh, t)}</span>
        <span>{formatPlugClock(snapshot?.clock, t)}</span>
      </div>

      <div className="plug-detail-card__section">
        <div className="plug-detail-card__section-heading">
          <strong>{t('hardware.metrics.relay')}</strong>
          <button
            className="secondary-action"
            type="button"
            disabled={busy}
            onClick={onRefresh}
          >
            {t('common.refresh')}
          </button>
        </div>
        {runtimeLoading && <p role="status">{t('hardware.shelly.localRpcConnecting')}</p>}
        {runtimeFailed && <p role="alert">{t('hardware.shelly.checkFailedDetail')}</p>}
        <div
          className="automation-relay-actions shelly-relay-actions plug-detail-card__relay"
          role="group"
          aria-label={t('hardware.metrics.relay')}
        >
          {[true, false].map((on) => (
            <button
              key={String(on)}
              className="automation-relay-button"
              type="button"
              aria-pressed={snapshot?.relayOn === on}
              disabled={!canControlRelay}
              onClick={() => void onSetRelay(on)}
            >
              {on ? 'ON' : 'OFF'}
            </button>
          ))}
        </div>
      </div>

      {plugRules.length > 0 && (
        <div className="plug-detail-card__section plug-detail-card__rules">
          <strong>{t('hardware.sensor.usedBy')}</strong>
          <div className="device-rule-links">
            {plugRules.map((rule) => (
              <button
                className="device-rule-link"
                key={rule.id}
                type="button"
                onClick={() => onOpenRule(rule.id)}
              >
                <span>{rule.name}</span>
                <small>
                  {rule.kind === 'time'
                    ? t('intent.time.context')
                    : t('intent.temperature.context')}
                </small>
              </button>
            ))}
          </div>
        </div>
      )}

      {snapshot?.managedScripts.some((script) => script.ruleIds.length === 0) && (
        <div className="plug-detail-card__section">
          <strong>{t('common.diagnostics')}</strong>
          <div className="plug-detail-card__orphan-list">
            {snapshot.managedScripts
              .filter((script) => script.ruleIds.length === 0)
              .map((script) => (
                <div className="plug-detail-card__orphan" key={script.id}>
                  <span>
                    {script.name} · #{script.id}
                  </span>
                  <button
                    className="secondary-action secondary-action--danger"
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteOrphan(script.id)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="plug-detail-card__danger-zone">
        <button
          className="secondary-action secondary-action--danger"
          type="button"
          disabled={busy}
          onClick={onRequestDelete}
        >
          <IconTrash aria-hidden="true" />
          <span>{t('common.delete')}</span>
        </button>
      </div>
    </div>
  );
};
