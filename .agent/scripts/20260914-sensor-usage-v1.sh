#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
BRANCH=work/device-rule-decoupling-20260913
EXPECTED=2edb38a0af814af09ebf001ddf57cac7d0622f25
cd "$REPO"

git fetch origin "$BRANCH"
REMOTE=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE" == "$EXPECTED" ]] || { echo "Unexpected remote head: $REMOTE"; exit 2; }
git checkout "$BRANCH"
git reset --hard "$REMOTE"
[[ -z "$(git status --porcelain)" ]] || { echo 'Worktree not clean'; exit 3; }

cat > apps/mobile/src/flows/devices/sensors/usage.ts <<'EOF'
import type { SavedPlug } from '../plugs/model.js';
import type { AutomationRule } from '../../rules/model.js';
import type { SavedSensor } from './model.js';

export type SensorRuleUsage = {
  ruleId: string;
  ruleName: string;
  plugId: string;
  plugName: string;
};

export type SensorRuleUsageById = Record<string, SensorRuleUsage[]>;

export const buildSensorRuleUsageById = (
  sensors: readonly SavedSensor[],
  rules: readonly AutomationRule[],
  plugs: readonly SavedPlug[]
): SensorRuleUsageById => {
  const plugNames = new Map(plugs.map((plug) => [plug.id, plug.name]));
  const usageById: SensorRuleUsageById = Object.fromEntries(
    sensors.map((sensor) => [sensor.id, []])
  );

  for (const rule of rules) {
    if (rule.kind !== 'climate') continue;
    const usages = usageById[rule.sensorId];
    if (!usages) continue;
    usages.push({
      ruleId: rule.id,
      ruleName: rule.name,
      plugId: rule.plugId,
      plugName: plugNames.get(rule.plugId) ?? rule.plugId
    });
  }

  return usageById;
};
EOF

cat > apps/mobile/src/flows/devices/sensors/usage.test.ts <<'EOF'
import { describe, expect, it } from 'vitest';
import { climate, plug, sensor, time } from '../../registry/fixtures.test-support.js';
import { buildSensorRuleUsageById } from './usage.js';

describe('thermometer rule usage', () => {
  it('derives Rule -> Plug relationships only from climate rules', () => {
    expect(
      buildSensorRuleUsageById(
        [sensor],
        [
          { ...climate, name: 'Grow temperature' },
          { ...time, id: 'rule-time-other', name: 'Lights schedule' }
        ],
        [{ ...plug, name: 'Heater plug' }]
      )
    ).toEqual({
      [sensor.id]: [
        {
          ruleId: climate.id,
          ruleName: 'Grow temperature',
          plugId: plug.id,
          plugName: 'Heater plug'
        }
      ]
    });
  });

  it('falls back to plug id when the referenced plug is missing', () => {
    expect(buildSensorRuleUsageById([sensor], [climate], [])[sensor.id]).toEqual([
      expect.objectContaining({ plugId: climate.plugId, plugName: climate.plugId })
    ]);
  });
});
EOF

python3 - <<'PY'
from pathlib import Path

# Route thermometer cards to rules and derive usage live from registries.
p = Path('apps/mobile/src/screens/devices/SensorManagementScreen.tsx')
s = p.read_text()
s = s.replace("import { useEffect, useRef } from 'react';", "import { useEffect, useMemo, useRef } from 'react';")
s = s.replace(
    "import { useSensorManagementFlow } from '../../flows/devices/sensors/useSensorManagementFlow.js';",
    "import { useSensorManagementFlow } from '../../flows/devices/sensors/useSensorManagementFlow.js';\nimport { buildSensorRuleUsageById } from '../../flows/devices/sensors/usage.js';\nimport { usePlugStore, useRuleStore } from '../../flows/registry/devicesAndRules.js';"
)
s = s.replace(
    "export const SensorManagementScreen = () => {\n  const { t } = useTranslation();\n  const flow = useSensorManagementFlow();",
    "export const SensorManagementScreen = ({\n  onOpenRule\n}: {\n  onOpenRule(id: string): void;\n}) => {\n  const { t } = useTranslation();\n  const flow = useSensorManagementFlow();\n  const plugs = usePlugStore((state) => state.items);\n  const rules = useRuleStore((state) => state.items);\n  const usageBySensorId = useMemo(\n    () => buildSensorRuleUsageById(flow.sensorDevices, rules, plugs),\n    [flow.sensorDevices, plugs, rules]\n  );"
)
s = s.replace(
    "      <SensorSetupPage flow={flow} />",
    "      <SensorSetupPage\n        flow={flow}\n        usageBySensorId={usageBySensorId}\n        onOpenRule={onOpenRule}\n      />"
)
p.write_text(s)

# Pass rule navigation from the app shell.
p = Path('apps/mobile/src/routes/AppRoutes.tsx')
s = p.read_text().replace(
    "      case 'sensors':\n        return <SensorManagementScreen />;",
    "      case 'sensors':\n        return (\n          <SensorManagementScreen\n            onOpenRule={(ruleId) => navigate({ type: 'rule', ruleId })}\n          />\n        );"
)
p.write_text(s)

# Show live usage and never report a blocked removal as success.
p = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx')
s = p.read_text()
s = s.replace(
    "import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';",
    "import type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';\nimport type { SensorRuleUsageById } from '../../../flows/devices/sensors/usage.js';"
)
s = s.replace(
    "export const SensorSetupPage = ({ flow }: HardwarePageProps<SensorSetupFlow>) => {",
    "type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {\n  usageBySensorId?: SensorRuleUsageById;\n  onOpenRule?(ruleId: string): void;\n};\n\nexport const SensorSetupPage = ({\n  flow,\n  usageBySensorId = {},\n  onOpenRule\n}: SensorSetupPageProps) => {"
)
s = s.replace(
    "  const sensorPendingRemoval = dialog.kind === 'remove' ? dialog.device : null;",
    "  const sensorPendingRemoval = dialog.kind === 'remove' ? dialog.device : null;\n  const pendingRemovalUsages = sensorPendingRemoval\n    ? (usageBySensorId[sensorPendingRemoval.id] ?? [])\n    : [];"
)
s = s.replace(
    "    flow.removeSensorDevice(sensorPendingRemoval.id);\n    setDialog({ kind: 'none' });\n    pushToast('ok', t('hardware.sensor.removed'));",
    "    const removed = flow.removeSensorDevice(sensorPendingRemoval.id);\n    if (!removed.ok) {\n      const detail =\n        removed.error.kind === 'device-referenced'\n          ? t('hardware.sensor.deleteBlockedByRule')\n          : t('common.operationFailed');\n      pushToast('warning', t('hardware.sensor.deleteFailedTitle'), detail);\n      return;\n    }\n    setDialog({ kind: 'none' });\n    pushToast('ok', t('hardware.sensor.removed'));"
)
s = s.replace(
    "            title={t('hardware.sensor.deleteTitle')}\n            onClick={confirmRemoveSensor}",
    "            title={t('hardware.sensor.deleteTitle')}\n            disabled={pendingRemovalUsages.length > 0}\n            onClick={confirmRemoveSensor}"
)
s = s.replace(
    "        <p>{t('hardware.sensor.deleteDescription')}</p>",
    "        <p>\n          {pendingRemovalUsages.length > 0\n            ? t('hardware.sensor.deleteBlockedByRule')\n            : t('hardware.sensor.deleteDescription')}\n        </p>"
)
needle = "          const isEditing = editingSensorId === device.id;\n\n          return ("
s = s.replace(
    needle,
    "          const isEditing = editingSensorId === device.id;\n          const usages = usageBySensorId[device.id] ?? [];\n\n          return ("
)
needle = "              <dl className=\"sensor-card-details\">"
# Insert usage block after details list, before article close, using a unique tail anchor.
tail = "              </dl>\n            </article>"
replacement = "              </dl>\n              {usages.length > 0 && (\n                <div className=\"field-stack\">\n                  <strong>{t('hardware.sensor.usedBy')}</strong>\n                  {usages.map((usage) =>\n                    onOpenRule ? (\n                      <button\n                        key={usage.ruleId}\n                        className=\"secondary-action\"\n                        type=\"button\"\n                        onClick={() => onOpenRule(usage.ruleId)}\n                      >\n                        {usage.ruleName} → {usage.plugName}\n                      </button>\n                    ) : (\n                      <span key={usage.ruleId}>\n                        {usage.ruleName} → {usage.plugName}\n                      </span>\n                    )\n                  )}\n                </div>\n              )}\n            </article>"
if tail not in s:
    raise SystemExit('Sensor card tail anchor missing')
s = s.replace(tail, replacement, 1)
p.write_text(s)

# Add localized copy to every locale sensor section.
translations = {
  'en.ts': {
    'usedBy': 'Used by',
    'deleteBlockedByRule': 'This thermometer is used by a rule. Open or delete the rule before removing the thermometer.',
    'deleteFailedTitle': 'Could not remove thermometer.'
  },
  'pl.ts': {
    'usedBy': 'Używany przez',
    'deleteBlockedByRule': 'Ten termometr jest używany przez regułę. Otwórz lub usuń regułę przed usunięciem termometru.',
    'deleteFailedTitle': 'Nie udało się usunąć termometru.'
  },
  'de.ts': {
    'usedBy': 'Verwendet von',
    'deleteBlockedByRule': 'Dieses Thermometer wird von einer Regel verwendet. Öffne oder lösche die Regel, bevor du das Thermometer entfernst.',
    'deleteFailedTitle': 'Thermometer konnte nicht entfernt werden.'
  },
  'es.ts': {
    'usedBy': 'Usado por',
    'deleteBlockedByRule': 'Este termómetro está siendo usado por una regla. Abre o elimina la regla antes de quitar el termómetro.',
    'deleteFailedTitle': 'No se pudo eliminar el termómetro.'
  },
  'fr.ts': {
    'usedBy': 'Utilisé par',
    'deleteBlockedByRule': 'Ce thermomètre est utilisé par une règle. Ouvrez ou supprimez la règle avant de retirer le thermomètre.',
    'deleteFailedTitle': 'Impossible de supprimer le thermomètre.'
  },
  'it.ts': {
    'usedBy': 'Usato da',
    'deleteBlockedByRule': 'Questo termometro è usato da una regola. Apri o elimina la regola prima di rimuovere il termometro.',
    'deleteFailedTitle': 'Impossibile rimuovere il termometro.'
  },
  'ptBr.ts': {
    'usedBy': 'Usado por',
    'deleteBlockedByRule': 'Este termômetro é usado por uma regra. Abra ou exclua a regra antes de remover o termômetro.',
    'deleteFailedTitle': 'Não foi possível remover o termômetro.'
  }
}
for filename, values in translations.items():
    p = Path('apps/mobile/src/app/locales') / filename
    s = p.read_text()
    anchor = "      typeLabel: '"
    start = s.find("    sensor: {")
    end = s.find("    rule: {", start)
    if start == -1 or end == -1:
        raise SystemExit(f'sensor locale section missing in {filename}')
    section = s[start:end]
    if 'usedBy:' in section:
        raise SystemExit(f'usage keys already present in {filename}')
    line_start = section.find(anchor)
    if line_start == -1:
        raise SystemExit(f'typeLabel anchor missing in {filename}')
    absolute = start + line_start
    line_end = s.find('\n', absolute)
    comma = ',' if not s[absolute:line_end].rstrip().endswith(',') else ''
    insertion = (
        f"{comma}\n      usedBy: {values['usedBy']!r},"
        f"\n      deleteBlockedByRule: {values['deleteBlockedByRule']!r},"
        f"\n      deleteFailedTitle: {values['deleteFailedTitle']!r}"
    )
    s = s[:line_end] + insertion + s[line_end:]
    p.write_text(s)
PY

pnpm exec prettier --write \
  apps/mobile/src/flows/devices/sensors/usage.ts \
  apps/mobile/src/flows/devices/sensors/usage.test.ts \
  apps/mobile/src/screens/devices/SensorManagementScreen.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/app/locales/{de,en,es,fr,it,pl,ptBr}.ts

pnpm --filter @lcl/mobile typecheck
pnpm --filter @lcl/mobile exec vitest run \
  src/flows/devices/sensors/usage.test.ts \
  src/flows/devices/sensors/useSensorManagementFlow.test.ts \
  src/__tests__/app-routes.test.tsx \
  src/__tests__/i18n.test.ts
pnpm lint
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build

git add \
  apps/mobile/src/flows/devices/sensors/usage.ts \
  apps/mobile/src/flows/devices/sensors/usage.test.ts \
  apps/mobile/src/screens/devices/SensorManagementScreen.tsx \
  apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx \
  apps/mobile/src/routes/AppRoutes.tsx \
  apps/mobile/src/app/locales/{de,en,es,fr,it,pl,ptBr}.ts

git commit -m "Show rule usage for thermometers"

git fetch origin "$BRANCH"
REMOTE_AFTER=$(git rev-parse "origin/$BRANCH")
[[ "$REMOTE_AFTER" == "$EXPECTED" ]] || { echo "Remote head changed before push: $REMOTE_AFTER"; exit 4; }
git push origin HEAD:"$BRANCH"
git fetch origin "$BRANCH"
FINAL_HEAD=$(git rev-parse "origin/$BRANCH")
echo "FINAL_HEAD=$FINAL_HEAD"
