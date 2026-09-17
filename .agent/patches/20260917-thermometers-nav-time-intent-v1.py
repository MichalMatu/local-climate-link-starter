from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, count))

# Bottom navigation: user-facing Time becomes Thermometers while keeping the
# current internal route key for a minimal, low-risk migration.
path = 'apps/mobile/src/components/AppBottomNavigation.tsx'
replace(path, "import { IconClock, IconPlug, IconSettings } from '@tabler/icons-react';", "import { IconPlug, IconSettings, IconTemperature } from '@tabler/icons-react';")
replace(path, "        <IconClock\n          className=\"dashboard-nav__icon app-bottom-nav__icon\"\n          aria-hidden=\"true\"\n        />", "        <IconTemperature\n          className=\"dashboard-nav__icon app-bottom-nav__icon\"\n          aria-hidden=\"true\"\n        />")

# Add Time to the per-plug automation intent picker.
path = 'apps/mobile/src/screens/SetupIntentScreen.tsx'
replace(path, "  {\n    id: 'humidity',\n    titleKey: 'intent.humidity.title',\n    descriptionKey: 'intent.humidity.description'\n  }\n] as const;", "  {\n    id: 'humidity',\n    titleKey: 'intent.humidity.title',\n    descriptionKey: 'intent.humidity.description'\n  },\n  {\n    id: 'time',\n    titleKey: 'intent.time.title',\n    descriptionKey: 'intent.time.description'\n  }\n] as const;")

# Sensor inventory: main Thermometers FAB starts the phone BLE scanner directly.
path = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace(path, "import { IconClock, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';", "import {\n  IconClock,\n  IconDeviceMobile,\n  IconPencil,\n  IconPlug,\n  IconPlus,\n  IconTrash\n} from '@tabler/icons-react';")
replace(path, "export const SensorSetupPage = ({ flow }: HardwarePageProps<SensorSetupFlow>) => {", "type SensorSetupPageProps = HardwarePageProps<SensorSetupFlow> & {\n  primaryAddAction?: 'manual' | 'phone-scan';\n};\n\nexport const SensorSetupPage = ({\n  flow,\n  primaryAddAction = 'manual'\n}: SensorSetupPageProps) => {")
replace(path, "        aria-label={t('hardware.sensor.add')}\n        title={t('hardware.sensor.addTitle')}\n        onClick={openAddSensorModal}", "        aria-label={\n          primaryAddAction === 'phone-scan'\n            ? t('hardware.sensor.scanPhoneTitle')\n            : t('hardware.sensor.add')\n        }\n        title={\n          primaryAddAction === 'phone-scan'\n            ? t('hardware.sensor.scanPhoneTitle')\n            : t('hardware.sensor.addTitle')\n        }\n        onClick={\n          primaryAddAction === 'phone-scan' ? openPhoneBleScanModal : openAddSensorModal\n        }")
replace(path, "                    <h3 className=\"sensor-card-title\">{device.name}</h3>\n                    <button", "                    <h3 className=\"sensor-card-title\">{device.name}</h3>\n                    {latest?.source === 'phone-scan' && (\n                      <span\n                        className=\"sensor-card-source\"\n                        title={t('hardware.sensor.scanPhoneTitle')}\n                      >\n                        <IconDeviceMobile className=\"icon-action__svg\" aria-hidden=\"true\" />\n                      </span>\n                    )}\n                    {latest?.source === 'shelly-scan' && (\n                      <span\n                        className=\"sensor-card-source\"\n                        title={t('hardware.nav.shellyTitle')}\n                      >\n                        <IconPlug className=\"icon-action__svg\" aria-hidden=\"true\" />\n                      </span>\n                    )}\n                    <button")

# Time setup started from a concrete plug should go straight to Schedule.
path = 'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx'
replace(path, "  if (plugAddOnly) return PLUG_ADD_HARDWARE_TABS;\n  if (setupIntent === 'time') return TIME_HARDWARE_TABS;", "  if (plugAddOnly) return PLUG_ADD_HARDWARE_TABS;\n  if (setupIntent === 'time') {\n    return fixedShellyId\n      ? TIME_HARDWARE_TABS.filter((tab) => tab.id === 'schedule')\n      : TIME_HARDWARE_TABS;\n  }")
replace(path, "            {setupIntent === 'time' ? t('common.cancel') : t('intent.back')}", "            {t('intent.back')}")

# Dashboard: all automation kinds belong to a plug; the second tab renders the
# existing thermometer inventory rather than a separate Time dashboard.
path = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace(path, "  IconAlertTriangle,\n  IconClock,\n  IconDotsVertical,", "  IconAlertTriangle,\n  IconDotsVertical,")
replace(path, "import { useShellyControlFlow } from '../flows/hardware-setup/useShellyControlFlow.js';", "import { useShellyControlFlow } from '../flows/hardware-setup/useShellyControlFlow.js';\nimport { useHardwareSetupFlow } from '../flows/hardware-setup/useHardwareSetupFlow.js';")
replace(path, "import { TimeAutomationCard } from './TimeAutomationCard.js';", "import { TimeAutomationCard } from './TimeAutomationCard.js';\nimport { SensorSetupPage } from './hardware-setup/pages/SensorSetupPage.js';")
insert_after = "const AutomationCard = ({ installation, onOpen }: AutomationCardProps) =>\n  installation.kind === 'time' ? (\n    <TimeAutomationCard installation={installation} onOpen={onOpen} />\n  ) : (\n    <ClimateAutomationCard installation={installation} onOpen={onOpen} />\n  );\n"
replacement = insert_after + "\nconst ThermometerDashboardSection = () => {\n  const flow = useHardwareSetupFlow();\n  return <SensorSetupPage flow={flow} primaryAddAction=\"phone-scan\" />;\n};\n"
replace(path, insert_after, replacement)
old = """  const climateInstallations = installations.filter(
    (installation): installation is ClimateInstalledAutomation =>
      installation.kind !== 'time'
  );
  const hasClimate = shellyDevices.length > 0 || climateInstallations.length > 0;
  const hasTime = installations.some((installation) => installation.kind === 'time');
  const [activeKind, setActiveKind] = useState<AppNavigationKind>(
    () => initialKind ?? (hasTime && !hasClimate ? 'time' : 'climate')
  );
"""
new = """  const [activeKind, setActiveKind] = useState<AppNavigationKind>(
    () => initialKind ?? 'climate'
  );
"""
replace(path, old, new)
old = """  const visibleInstallations = installations.filter((installation) =>
    activeKind === 'time' ? installation.kind === 'time' : installation.kind !== 'time'
  );
  const normalizedBaseUrl = (value: string) =>
    value.trim().replace(/\\/+$/, '').toLowerCase();
  const matchedClimateInstallationIds = new Set<string>();
  const plugEntries = shellyDevices.map((device) => {
    const installation =
      climateInstallations.find(
        (candidate) =>
          normalizedBaseUrl(candidate.shelly.baseUrl) ===
          normalizedBaseUrl(device.baseUrl)
      ) ?? null;
    if (installation) matchedClimateInstallationIds.add(installation.id);
    return { device, installation };
  });
  const unmatchedClimateInstallations = climateInstallations.filter(
    (installation) => !matchedClimateInstallationIds.has(installation.id)
  );
  const hasPlugEntries =
    plugEntries.length > 0 || unmatchedClimateInstallations.length > 0;
  const fabLabel =
    activeKind === 'climate' ? t('hardware.shelly.add') : t('dashboard.addAutomation');
"""
new = """  const normalizedBaseUrl = (value: string) =>
    value.trim().replace(/\\/+$/, '').toLowerCase();
  const matchedInstallationIds = new Set<string>();
  const plugEntries = shellyDevices.map((device) => {
    const installation =
      installations.find(
        (candidate) =>
          normalizedBaseUrl(candidate.shelly.baseUrl) ===
          normalizedBaseUrl(device.baseUrl)
      ) ?? null;
    if (installation) matchedInstallationIds.add(installation.id);
    return { device, installation };
  });
  const unmatchedInstallations = installations.filter(
    (installation) => !matchedInstallationIds.has(installation.id)
  );
  const hasPlugEntries = plugEntries.length > 0 || unmatchedInstallations.length > 0;
  const fabLabel = t('hardware.shelly.add');
"""
replace(path, old, new)
replace(path, "          {activeKind === 'climate' ? t('dashboard.climateTab') : t('dashboard.title')}", "          {activeKind === 'climate' ? t('dashboard.climateTab') : t('dashboard.timeTab')}")
old = """        {activeKind === 'time' ? (
          visibleInstallations.length > 0 ? (
            visibleInstallations.map((installation) => (
              <AutomationCard
                key={installation.id}
                installation={installation}
                onOpen={onOpenInstallation}
              />
            ))
          ) : (
            <div className="dashboard-kind-empty" role="status">
              <IconClock className="dashboard-kind-empty__icon" aria-hidden="true" />
              <strong>{t('dashboard.emptyCategory')}</strong>
            </div>
          )
        ) : hasPlugEntries ? (
"""
new = """        {activeKind === 'time' ? (
          <ThermometerDashboardSection />
        ) : hasPlugEntries ? (
"""
replace(path, old, new)
replace(path, "                <ClimateAutomationCard\n                  key={installation.id}\n                  installation={installation}\n                  onOpen={onOpenInstallation}\n                />", "                <AutomationCard\n                  key={installation.id}\n                  installation={installation}\n                  onOpen={onOpenInstallation}\n                />")
replace(path, "            {unmatchedClimateInstallations.map((installation) => (\n              <ClimateAutomationCard", "            {unmatchedInstallations.map((installation) => (\n              <AutomationCard")
old = """      <button
        className="dashboard-fab"
        type="button"
        aria-label={fabLabel}
        title={fabLabel}
        onClick={() => {
          if (activeKind === 'climate') {
            onAddPlug();
            return;
          }
          onAddAutomation(activeKind);
        }}
      >
        <IconPlus className="dashboard-fab__icon" aria-hidden="true" />
      </button>
"""
new = """      {activeKind === 'climate' && (
        <button
          className="dashboard-fab"
          type="button"
          aria-label={fabLabel}
          title={fabLabel}
          onClick={onAddPlug}
        >
          <IconPlus className="dashboard-fab__icon" aria-hidden="true" />
        </button>
      )}
"""
replace(path, old, new)

# Routing: Time is selected from the plug's intent picker, so setup/back/detail
# all return to the Plug surface rather than the second bottom tab.
path = 'apps/mobile/src/routes/AppRoutes.tsx'
old = """  if (route.type === 'setup') {
    return route.intent === 'time'
      ? { type: 'dashboard', kind: 'time' }
      : {
          type: 'intent',
          sourceKind: route.sourceKind,
          ...(route.shellyId ? { shellyId: route.shellyId } : {})
        };
  }
"""
new = """  if (route.type === 'setup') {
    return {
      type: 'intent',
      sourceKind: route.sourceKind,
      ...(route.shellyId ? { shellyId: route.shellyId } : {})
    };
  }
"""
replace(path, old, new)
replace(path, "\nconst setupKindForIntent = (intent: SetupRouteIntent): AppNavigationKind =>\n  intent === 'time' ? 'time' : 'climate';\n", "\n")
old = """  const selectIntent = (intent: SetupIntent, shellyId?: string) => {
    const nextKind = setupKindForIntent(intent);
    if (shellyId) selectShellyDevice(shellyId);
    navigate({
      type: 'setup',
      intent,
      sourceKind: nextKind,
      ...(shellyId ? { shellyId } : {})
    });
  };
"""
new = """  const selectIntent = (
    intent: SetupIntent,
    sourceKind: AppNavigationKind,
    shellyId?: string
  ) => {
    if (shellyId) selectShellyDevice(shellyId);
    navigate({
      type: 'setup',
      intent,
      sourceKind,
      ...(shellyId ? { shellyId } : {})
    });
  };
"""
replace(path, old, new)
replace(path, "        onSelect={(intent) => selectIntent(intent, route.shellyId)}", "        onSelect={(intent) => selectIntent(intent, route.sourceKind, route.shellyId)}")
replace(path, "            kind: installation?.kind === 'time' ? 'time' : 'climate'", "            kind: 'climate'")
old = """        onBackToIntent={() =>
          navigate(
            route.intent === 'time'
              ? { type: 'dashboard', kind: 'time' }
              : {
                  type: 'intent',
                  sourceKind: route.sourceKind,
                  ...(route.shellyId ? { shellyId: route.shellyId } : {})
                }
          )
        }
"""
new = """        onBackToIntent={() =>
          navigate({
            type: 'intent',
            sourceKind: route.sourceKind,
            ...(route.shellyId ? { shellyId: route.shellyId } : {})
          })
        }
"""
replace(path, old, new)

# User-facing bottom label only; internal route key remains unchanged in this patch.
labels = {
    'pl.ts': 'Termometry',
    'en.ts': 'Thermometers',
    'de.ts': 'Thermometer',
    'es.ts': 'Termómetros',
    'fr.ts': 'Thermomètres',
    'it.ts': 'Termometri',
    'ptBr.ts': 'Termômetros',
}
for filename, label in labels.items():
    p = Path('apps/mobile/src/app/locales') / filename
    text = p.read_text()
    lines = text.splitlines()
    changed = False
    for i, line in enumerate(lines):
        if line.strip().startswith('timeTab:'):
            indent = line[: len(line) - len(line.lstrip())]
            lines[i] = f"{indent}timeTab: '{label}',"
            changed = True
            break
    if not changed:
        raise SystemExit(f'timeTab missing in {filename}')
    p.write_text('\n'.join(lines) + '\n')
