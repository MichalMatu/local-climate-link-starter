#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=248c2c673c1b90347479f932a85bda78af10a564
cd "$REPO"

git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }

cat > apps/mobile/src/screens/devices/PlugDetailContent.tsx <<'EOF'
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
          <button className="secondary-action" type="button" disabled={busy} onClick={onRefresh}>
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
                <small>{rule.kind === 'time' ? t('intent.time.context') : t('intent.temperature.context')}</small>
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
                  <span>{script.name} · #{script.id}</span>
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
EOF

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/screens/devices/SavedPlugCard.tsx')
s=p.read_text()
s=s.replace("  const telemetry = snapshot?.telemetry;\n", "  const telemetry = snapshot?.telemetry;\n  const owner = rules.find((rule) => rule.plugId === plug.id && rule.relayId === 0);\n")
needle="""      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
"""
insert="""      <div className="shelly-state-strip">
        <span>
          {t('hardware.metrics.relay')}{' '}
          <strong>{snapshot ? (snapshot.relayOn ? 'ON' : 'OFF') : t('common.missing')}</strong>
        </span>
        <span>
          {t('time.owner')}{' '}
          <strong>{owner?.name ?? t('common.missing')}</strong>
        </span>
      </div>

"""+needle
if needle not in s: raise SystemExit('metrics marker missing')
s=s.replace(needle,insert)
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/screens/devices/SensorRuleUsageList.tsx')
s=p.read_text()
s=s.replace('<div className="field-stack">', '<div className="sensor-rule-usage">')
s=s.replace('className="secondary-action"', 'className="sensor-rule-usage__link"')
s=s.replace("            {usage.ruleName} → {usage.plugName}\n", "            <span>{usage.ruleName}</span>\n            <small>{usage.plugName}</small>\n")
s=s.replace("          <span key={usage.ruleId}>\n            {usage.ruleName} → {usage.plugName}\n          </span>", "          <span className=\"sensor-rule-usage__item\" key={usage.ruleId}>\n            <span>{usage.ruleName}</span>\n            <small>{usage.plugName}</small>\n          </span>")
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/screens/devices/PlugManagementScreen.tsx')
s=p.read_text()
s=s.replace("import { IconPlus, IconTrash } from '@tabler/icons-react';", "import { IconPlus } from '@tabler/icons-react';")
s=s.replace("import { SavedPlugCard } from './SavedPlugCard.js';", "import { PlugDetailContent } from './PlugDetailContent.js';\nimport { SavedPlugCard } from './SavedPlugCard.js';")
# include rename mutation in busy state
s=s.replace("    flow.orphanRemoval.isPending ||\n    flow.removal.isPending;", "    flow.orphanRemoval.isPending ||\n    flow.rename.isPending ||\n    flow.removal.isPending;")
old="""        actions={
          <>
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                void flow.runtime.refetch();
              }}
            >
              {t('common.refresh')}
            </button>
            <button
              className="secondary-action secondary-action--danger"
              type="button"
              aria-label={t('common.delete')}
              onClick={() => setDialog('remove')}
            >
              <IconTrash />
            </button>
          </>
        }
      >
        {flow.runtime.isFetching && (
          <p role="status">{t('hardware.shelly.localRpcConnecting')}</p>
        )}
        {(flow.runtimeError || flow.runtime.isError) && (
          <p role="alert">{t('hardware.shelly.checkFailedDetail')}</p>
        )}
        {selected && (
          <>
            <div className="automation-relay-actions">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  className="automation-relay-button"
                  type="button"
                  aria-pressed={flow.snapshot?.relayOn === on}
                  disabled={!flow.canControlRelay}
                  onClick={async () => {
                    report(await flow.relay.mutateAsync({ id: selected.id, on }));
                  }}
                >
                  {on ? 'ON' : 'OFF'}
                </button>
              ))}
            </div>
            {flow.rules
              .filter((rule) => rule.plugId === selected.id)
              .map((rule) => (
                <div className="action-row" key={rule.id}>
                  <button
                    className="secondary-action"
                    type="button"
                    onClick={() => onOpenRule(rule.id)}
                  >
                    {rule.name}
                  </button>
                </div>
              ))}
            {flow.snapshot?.managedScripts.map((script) => (
              <div className="saved-list__row" key={script.id}>
                <span>
                  {script.name} · #{script.id}
                </span>
                {!script.ruleIds.length && (
                  <button
                    className="secondary-action secondary-action--danger"
                    type="button"
                    onClick={() => {
                      setScriptId(script.id);
                      setDialog('orphan');
                    }}
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            ))}
          </>
        )}
"""
new="""        actions={null}
      >
        {selected && (
          <PlugDetailContent
            plug={selected}
            snapshot={flow.snapshot}
            rules={flow.rules}
            canControlRelay={flow.canControlRelay}
            busy={busy}
            runtimeLoading={flow.runtime.isFetching}
            runtimeFailed={Boolean(flow.runtimeError || flow.runtime.isError)}
            onRefresh={() => {
              void flow.runtime.refetch();
            }}
            onRename={async (nextName) =>
              report(await flow.rename.mutateAsync({ id: selected.id, name: nextName }))
            }
            onSetRelay={async (on) => {
              report(await flow.relay.mutateAsync({ id: selected.id, on }));
            }}
            onOpenRule={onOpenRule}
            onDeleteOrphan={(nextScriptId) => {
              setScriptId(nextScriptId);
              setDialog('orphan');
            }}
            onRequestDelete={() => setDialog('remove')}
          />
        )}
"""
if old not in s: raise SystemExit('detail block missing')
s=s.replace(old,new)
p.write_text(s)
PY

cat >> apps/mobile/src/theme/theme.css <<'EOF'

/* Device cards: preserve the polished setup-era presentation while using rule/device registries. */
.plug-detail-card {
  display: grid;
  gap: var(--lcl-spacing-md);
}

.plug-detail-card__name-row {
  align-items: end;
  display: grid;
  gap: var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, 1fr) auto;
}

.plug-detail-card__name-field {
  min-width: 0;
}

.plug-detail-card__save-name {
  min-height: var(--lcl-size-control-min-height);
}

.plug-detail-card__identity {
  display: grid;
  gap: var(--lcl-spacing-xs) var(--lcl-spacing-md);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  margin: 0;
}

.plug-detail-card__identity > div {
  display: grid;
  gap: var(--lcl-spacing-xs);
}

.plug-detail-card__identity dt,
.sensor-rule-usage > strong {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-semibold);
}

.plug-detail-card__identity dd {
  font-size: var(--lcl-font-size-sm);
  font-weight: var(--lcl-font-weight-bold);
  margin: 0;
  overflow-wrap: anywhere;
}

.plug-detail-card__metrics {
  width: 100%;
}

.plug-detail-card__section {
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  display: grid;
  gap: var(--lcl-spacing-sm);
  padding-top: var(--lcl-spacing-md);
}

.plug-detail-card__section-heading {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
}

.plug-detail-card__relay {
  margin: 0;
}

.device-rule-links,
.plug-detail-card__orphan-list,
.sensor-rule-usage {
  display: grid;
  gap: var(--lcl-spacing-xs);
}

.device-rule-link,
.sensor-rule-usage__link,
.sensor-rule-usage__item {
  align-items: center;
  background: var(--lcl-color-surface-muted);
  border: 0;
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text);
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
  min-height: var(--lcl-size-compact-control-min-height);
  padding: var(--lcl-spacing-sm) var(--lcl-spacing-md);
  text-align: left;
  width: 100%;
}

.device-rule-link,
.sensor-rule-usage__link {
  cursor: pointer;
}

.device-rule-link:hover,
.device-rule-link:focus-visible,
.sensor-rule-usage__link:hover,
.sensor-rule-usage__link:focus-visible {
  outline: var(--lcl-border-width-md) solid var(--lcl-color-focus-ring);
  outline-offset: var(--lcl-border-width-sm);
}

.device-rule-link span,
.sensor-rule-usage__link span,
.sensor-rule-usage__item span {
  font-weight: var(--lcl-font-weight-bold);
  min-width: 0;
  overflow-wrap: anywhere;
}

.device-rule-link small,
.sensor-rule-usage__link small,
.sensor-rule-usage__item small {
  color: var(--lcl-color-text-muted);
  flex: 0 0 auto;
  text-align: right;
}

.plug-detail-card__orphan {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
}

.plug-detail-card__orphan > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.plug-detail-card__danger-zone {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--lcl-spacing-sm);
}

.plug-detail-card__danger-zone .secondary-action {
  align-items: center;
  display: inline-flex;
  gap: var(--lcl-spacing-xs);
}
EOF

pnpm exec prettier --write \
  apps/mobile/src/screens/devices/PlugDetailContent.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/SensorRuleUsageList.tsx \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/theme/theme.css
pnpm exec eslint \
  apps/mobile/src/screens/devices/PlugDetailContent.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/SensorRuleUsageList.tsx \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx
pnpm quality:ux
pnpm --filter @lcl/mobile typecheck

git add \
  apps/mobile/src/screens/devices/PlugDetailContent.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/SensorRuleUsageList.tsx \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/theme/theme.css
git commit --no-verify -m "Integrate restored device card UX"
HUSKY=0 git push origin HEAD:"$BRANCH"
echo "FINAL_HEAD=$(git rev-parse HEAD)"
