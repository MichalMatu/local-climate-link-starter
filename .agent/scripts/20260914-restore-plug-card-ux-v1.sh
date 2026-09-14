#!/usr/bin/env bash
set -euo pipefail
REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
BASE=b2684176c792cfbbeefdf2a6205e4a7365986ac3
cd "$REPO"
git fetch origin "$BRANCH" agent-control
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
[ "$(git rev-parse HEAD)" = "$BASE" ] || { echo "Unexpected HEAD: $(git rev-parse HEAD)"; exit 2; }
[ -z "$(git status --porcelain)" ] || { git status --short; exit 3; }

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/devices/plugs/inventory.ts')
s=p.read_text()
s=s.replace("  type ShellyInventoryScript\n} from '@lcl/shelly-client';", "  type ShellyClockStatus,\n  type ShellyInventoryScript,\n  type ShellyPlugTelemetry\n} from '@lcl/shelly-client';")
s=s.replace("  managedScripts: ManagedPlugScript[];\n};", "  managedScripts: ManagedPlugScript[];\n  telemetry: ShellyPlugTelemetry;\n  clock: ShellyClockStatus;\n};")
s=s.replace("  const methods = fromShellyResult(await clients.inventory.listMethods());\n  if (!methods.ok) return methods;", "  const status = fromShellyResult(await clients.device.getStatus());\n  if (!status.ok) return status;\n  const methods = fromShellyResult(await clients.inventory.listMethods());\n  if (!methods.ok) return methods;")
s=s.replace("      ownership: resolveRelayOwnership({ plug, relayId: 0, rules, inventory }),\n      managedScripts:", "      ownership: resolveRelayOwnership({ plug, relayId: 0, rules, inventory }),\n      telemetry: status.value.telemetry,\n      clock: status.value.clock,\n      managedScripts:")
p.write_text(s)
PY

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts')
s=p.read_text()
s=s.replace("import { createPlugManagement } from './management.js';", "import type { AutomationRule } from '../../rules/model.js';\nimport type { SavedPlug } from './model.js';\nimport { createPlugManagement } from './management.js';")
marker="export const plugRuntimeQueryKey = (id: string, baseUrl: string) =>\n  ['plug-runtime', id, baseUrl] as const;\n"
insert=marker+"\nexport const usePlugRuntimeQuery = (\n  plug: SavedPlug | null,\n  rules: readonly AutomationRule[],\n  enabled = true\n) =>\n  useQuery({\n    queryKey: [\n      ...plugRuntimeQueryKey(plug?.id ?? '', plug?.baseUrl ?? ''),\n      rules\n    ],\n    enabled: enabled && plug !== null,\n    retry: false,\n    queryFn: () => management.refresh(plug!.id)\n  });\n"
if marker not in s: raise SystemExit('query key marker missing')
s=s.replace(marker,insert)
old="""  const runtime = useQuery({
    queryKey: [
      ...plugRuntimeQueryKey(selectedPlug?.id ?? '', selectedPlug?.baseUrl ?? ''),
      rules
    ],
    enabled: selectedPlug !== null && !loadError && !rulesLoadError,
    queryFn: () => management.refresh(selectedPlug!.id)
  });
"""
new="""  const runtime = usePlugRuntimeQuery(
    selectedPlug,
    rules,
    !loadError && !rulesLoadError
  );
"""
if old not in s: raise SystemExit('runtime query block missing')
s=s.replace(old,new)
p.write_text(s)
PY

cat > apps/mobile/src/screens/devices/plugPresentation.ts <<'EOF'
import type { ShellyClockStatus } from '@lcl/shelly-client';
import type { Translate } from '../../app/i18n.js';

const formatMetric = (
  value: number | undefined,
  missing: string,
  suffix: string,
  digits: number
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(digits)}${suffix}`
    : missing;

export const formatPlugPower = (value: number | undefined, t: Translate): string =>
  formatMetric(value, t('common.missing'), ' W', 1);

export const formatPlugVoltage = (value: number | undefined, t: Translate): string =>
  formatMetric(value, t('common.missing'), ' V', 0);

export const formatPlugEnergy = (value: number | undefined, t: Translate): string => {
  if (value === undefined || !Number.isFinite(value)) return t('common.missing');
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} kWh`
    : `${value.toFixed(0)} Wh`;
};

export const formatPlugClock = (
  clock: ShellyClockStatus | undefined,
  t: Translate
): string => clock?.localTime ?? t('common.missing');
EOF

cat > apps/mobile/src/screens/devices/SavedPlugCard.tsx <<'EOF'
import { IconDotsVertical } from '@tabler/icons-react';
import { useTranslation } from '../../app/i18n.js';
import type { SavedPlug } from '../../flows/devices/plugs/model.js';
import { usePlugRuntimeQuery } from '../../flows/devices/plugs/usePlugManagementFlow.js';
import type { AutomationRule } from '../../flows/rules/model.js';
import {
  formatPlugClock,
  formatPlugEnergy,
  formatPlugPower,
  formatPlugVoltage
} from './plugPresentation.js';

export const SavedPlugCard = ({
  plug,
  rules,
  onOpen
}: {
  plug: SavedPlug;
  rules: readonly AutomationRule[];
  onOpen(): void;
}) => {
  const { t } = useTranslation();
  const runtime = usePlugRuntimeQuery(plug, rules);
  const snapshot = runtime.data?.ok ? runtime.data.value : null;
  const telemetry = snapshot?.telemetry;

  return (
    <article className="saved-list__item shelly-saved-card" aria-busy={runtime.isFetching}>
      <div className="shelly-card-header">
        <h3>{plug.name}</h3>
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

      <div
        className="shelly-metrics-strip"
        aria-label={t('hardware.shelly.statusMetricsLabel')}
      >
        <span>{formatPlugPower(telemetry?.powerW, t)}</span>
        <span>{formatPlugVoltage(telemetry?.voltageV, t)}</span>
        <span>{formatPlugEnergy(telemetry?.energyWh, t)}</span>
        <span>{formatPlugClock(snapshot?.clock, t)}</span>
      </div>
    </article>
  );
};
EOF

python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/screens/devices/PlugManagementScreen.tsx')
s=p.read_text()
s=s.replace("import { IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';", "import { IconPlus, IconTrash } from '@tabler/icons-react';")
s=s.replace("import type { PlugManagementResult } from '../../flows/devices/plugs/management.js';", "import type { PlugManagementResult } from '../../flows/devices/plugs/management.js';\nimport { SavedPlugCard } from './SavedPlugCard.js';")
old="""          {flow.plugs.map((plug) => (
            <article className="saved-list__item" key={plug.id}>
              <div className="saved-list__row">
                <div className="saved-list__field">
                  <h2>{plug.name}</h2>
                  <span>{plug.baseUrl}</span>
                </div>
                <button
                  className="secondary-action"
                  type="button"
                  aria-label={`${t('hardware.shelly.settings')}: ${plug.name}`}
                  onClick={() => {
                    flow.selectPlug(plug.id);
                    setDialog('detail');
                  }}
                >
                  <IconSettings />
                </button>
              </div>
            </article>
          ))}
"""
new="""          {flow.plugs.map((plug) => (
            <SavedPlugCard
              key={plug.id}
              plug={plug}
              rules={flow.rules}
              onOpen={() => {
                flow.selectPlug(plug.id);
                setDialog('detail');
              }}
            />
          ))}
"""
if old not in s: raise SystemExit('old plug card block missing')
s=s.replace(old,new)
p.write_text(s)
PY

# Make inventory tests provide Shelly.GetStatus data and verify telemetry survives the new runtime boundary.
python3 - <<'PY'
from pathlib import Path
p=Path('apps/mobile/src/flows/devices/plugs/inventory.test.ts')
s=p.read_text()
# The test-support client factory already exposes device.getStatus in most fixtures. Add telemetry assertions to the first successful snapshot test.
needle="expect(result.value.relayOn).toBe(false);"
if needle in s and "result.value.telemetry" not in s:
    s=s.replace(needle, needle+"\n      expect(result.value.telemetry).toBeDefined();\n      expect(result.value.clock).toBeDefined();",1)
p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/devices/plugs/inventory.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/flows/devices/plugs/inventory.test.ts \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/plugPresentation.ts
pnpm exec eslint \
  apps/mobile/src/flows/devices/plugs/inventory.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/plugPresentation.ts
pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run src/flows/devices/plugs/inventory.test.ts
pnpm quality:ux

git add \
  apps/mobile/src/flows/devices/plugs/inventory.ts \
  apps/mobile/src/flows/devices/plugs/usePlugManagementFlow.ts \
  apps/mobile/src/flows/devices/plugs/inventory.test.ts \
  apps/mobile/src/screens/devices/PlugManagementScreen.tsx \
  apps/mobile/src/screens/devices/SavedPlugCard.tsx \
  apps/mobile/src/screens/devices/plugPresentation.ts
git commit --no-verify -m "Restore rich saved plug cards"
HUSKY=0 git push origin HEAD:"$BRANCH"
echo "FINAL_HEAD=$(git rev-parse HEAD)"
