from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


# Rule setup: Shelly, thermometer and rule mode all use the shared in-app listbox.
rule_path = Path('apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx')
text = rule_path.read_text()
text = replace_once(
    text,
    "import { FeedbackPanel, Modal, ScriptPreview, ToastViewport } from '@lcl/ui';",
    "import { FeedbackPanel, Modal, ScriptPreview, SelectField, ToastViewport } from '@lcl/ui';",
    'RuleSetupPage @lcl/ui import',
)
text = text.replace("  const ruleModeSelectId = useId();\n", "")
old = """      {showShellySelector && (\n        <label className=\"field\">\n          {t('hardware.rule.selectedShelly')}\n          <span className=\"select-control\">\n            <select\n              value={flow.selectedShellyId ?? ''}\n              onChange={(event) => flow.selectShellyDevice(event.currentTarget.value)}\n            >\n              <option value=\"\" disabled>\n                {t('hardware.rule.noShellySelected')}\n              </option>\n              {flow.shellyDevices.map((device) => (\n                <option key={device.id} value={device.id}>\n                  {device.name}\n                </option>\n              ))}\n            </select>\n          </span>\n        </label>\n      )}\n\n      <label className=\"field\">\n        {t('hardware.rule.selectedSensor')}\n        <span className=\"select-control\">\n          <select\n            value={flow.selectedSensorId ?? ''}\n            onChange={(event) => flow.selectSensorDevice(event.currentTarget.value)}\n          >\n            <option value=\"\" disabled>\n              {t('hardware.flow.noSelectedSensor')}\n            </option>\n            {flow.sensorDevices.map((device) => (\n              <option key={device.id} value={device.id}>\n                {device.name}\n              </option>\n            ))}\n          </select>\n        </span>\n      </label>\n\n      <div className=\"field\">\n        <div className=\"rule-field-label-row\">\n          <label htmlFor={ruleModeSelectId}>{t('hardware.rule.ruleMode')}</label>\n          <button\n            aria-label={t('hardware.rule.summaryTitle')}\n            className=\"icon-action rule-summary-icon-action\"\n            type=\"button\"\n            title={t('hardware.rule.summaryTitle')}\n            onClick={() => setDialog('summary')}\n          >\n            <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />\n          </button>\n        </div>\n        <span className=\"select-control\">\n          <select\n            id={ruleModeSelectId}\n            value={flow.rulePreset}\n            onChange={(event) =>\n              flow.setRulePreset(event.currentTarget.value as RulePresetId)\n            }\n          >\n            {selectablePresets.map((preset) => (\n              <option key={preset} value={preset}>\n                {t(RULE_PRESET_COPY[preset].labelKey)}\n              </option>\n            ))}\n          </select>\n        </span>\n      </div>\n"""
new = """      {showShellySelector && (\n        <div className=\"field\">\n          <span>{t('hardware.rule.selectedShelly')}</span>\n          <SelectField\n            ariaLabel={t('hardware.rule.selectedShelly')}\n            value={flow.selectedShellyId ?? ''}\n            placeholder={t('hardware.rule.noShellySelected')}\n            options={flow.shellyDevices.map((device) => ({\n              value: device.id,\n              label: device.name\n            }))}\n            onChange={flow.selectShellyDevice}\n          />\n        </div>\n      )}\n\n      <div className=\"field\">\n        <span>{t('hardware.rule.selectedSensor')}</span>\n        <SelectField\n          ariaLabel={t('hardware.rule.selectedSensor')}\n          value={flow.selectedSensorId ?? ''}\n          placeholder={t('hardware.flow.noSelectedSensor')}\n          options={flow.sensorDevices.map((device) => ({\n            value: device.id,\n            label: device.name\n          }))}\n          onChange={flow.selectSensorDevice}\n        />\n      </div>\n\n      <div className=\"field\">\n        <div className=\"rule-field-label-row\">\n          <span>{t('hardware.rule.ruleMode')}</span>\n          <button\n            aria-label={t('hardware.rule.summaryTitle')}\n            className=\"icon-action rule-summary-icon-action\"\n            type=\"button\"\n            title={t('hardware.rule.summaryTitle')}\n            onClick={() => setDialog('summary')}\n          >\n            <IconInfoCircle className=\"icon-action__svg\" aria-hidden=\"true\" />\n          </button>\n        </div>\n        <SelectField<RulePresetId>\n          ariaLabel={t('hardware.rule.ruleMode')}\n          value={flow.rulePreset}\n          options={selectablePresets.map((preset) => ({\n            value: preset,\n            label: t(RULE_PRESET_COPY[preset].labelKey)\n          }))}\n          onChange={flow.setRulePreset}\n        />\n      </div>\n"""
text = replace_once(text, old, new, 'RuleSetupPage native selects')
rule_path.write_text(text)

# Sensor add form: thermometer profile uses the same shared listbox.
sensor_path = Path('apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx')
text = sensor_path.read_text()
text = replace_once(
    text,
    "} from '@tabler/icons-react';\nimport { useEffect, useId, useRef, useState } from 'react';",
    "} from '@tabler/icons-react';\nimport { SelectField } from '@lcl/ui';\nimport { useEffect, useId, useRef, useState } from 'react';",
    'SensorSetupPresentation SelectField import',
)
old = """      <label className=\"field\">\n        {t('hardware.sensor.profileLabel')}\n        <span className=\"select-control\">\n          <select\n            value={flow.sensorProfileInput}\n            onChange={(event) =>\n              flow.setSensorProfileInput(\n                event.currentTarget.value as typeof flow.sensorProfileInput\n              )\n            }\n          >\n            <option value=\"xiaomi_lywsd03mmc_bthome_v2\">\n              {sensorProfileLabels.xiaomi_lywsd03mmc_bthome_v2}\n            </option>\n            <option value=\"tp357_custom_v1\">{sensorProfileLabels.tp357_custom_v1}</option>\n          </select>\n        </span>\n      </label>\n"""
new = """      <div className=\"field\">\n        <span>{t('hardware.sensor.profileLabel')}</span>\n        <SelectField\n          ariaLabel={t('hardware.sensor.profileLabel')}\n          value={flow.sensorProfileInput}\n          options={[\n            {\n              value: 'xiaomi_lywsd03mmc_bthome_v2',\n              label: sensorProfileLabels.xiaomi_lywsd03mmc_bthome_v2\n            },\n            { value: 'tp357_custom_v1', label: sensorProfileLabels.tp357_custom_v1 }\n          ]}\n          onChange={(value) =>\n            flow.setSensorProfileInput(value as typeof flow.sensorProfileInput)\n          }\n        />\n      </div>\n"""
text = replace_once(text, old, new, 'SensorSetupPresentation native select')
sensor_path.write_text(text)

# Diagnostics: Shelly selector also uses the shared listbox.
diag_path = Path('apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx')
text = diag_path.read_text()
text = replace_once(
    text,
    "import { DiagnosticRow, ToastViewport } from '@lcl/ui';",
    "import { DiagnosticRow, SelectField, ToastViewport } from '@lcl/ui';",
    'DiagnosticsSetupPage @lcl/ui import',
)
old = """      <label className=\"field\">\n        {t('hardware.rule.selectedShelly')}\n        <span className=\"select-control\">\n          <select\n            value={flow.diagnosticShellyId ?? ''}\n            onChange={(event) => flow.setDiagnosticShellyId(event.currentTarget.value)}\n          >\n            <option value=\"\" disabled>\n              {t('hardware.rule.noShellySelected')}\n            </option>\n            {flow.shellyDevices.map((device) => (\n              <option key={device.id} value={device.id}>\n                {device.name}\n              </option>\n            ))}\n          </select>\n        </span>\n      </label>\n"""
new = """      <div className=\"field\">\n        <span>{t('hardware.rule.selectedShelly')}</span>\n        <SelectField\n          ariaLabel={t('hardware.rule.selectedShelly')}\n          value={flow.diagnosticShellyId ?? ''}\n          placeholder={t('hardware.rule.noShellySelected')}\n          options={flow.shellyDevices.map((device) => ({\n            value: device.id,\n            label: device.name\n          }))}\n          onChange={flow.setDiagnosticShellyId}\n        />\n      </div>\n"""
text = replace_once(text, old, new, 'DiagnosticsSetupPage native select')
diag_path.write_text(text)

# UX gate: native selects are no longer an allowed product pattern anywhere in mobile src.
ux_path = Path('scripts/quality/ux-gate.mjs')
text = ux_path.read_text()
old = """const checkSelectControlPatterns = async () => {\n  for (const path of hardwareSetupPagePaths) {\n    const source = await readRepoFile(path);\n    const selectMatches = source.matchAll(/<select\\b/g);\n\n    for (const match of selectMatches) {\n      const index = match.index ?? 0;\n      const precedingSource = source.slice(Math.max(0, index - 220), index);\n      if (!precedingSource.includes('select-control')) {\n        addFailure(\n          path,\n          'native select must be wrapped in select-control for tokenized field styling'\n        );\n      }\n    }\n  }\n};\n"""
new = """const checkNativeSelectPatterns = async () => {\n  const paths = (await listRepoFiles('apps/mobile/src')).filter(\n    (path) =>\n      path.endsWith('.tsx') &&\n      !path.includes('/__tests__/') &&\n      !/\\.(?:test|spec)\\.tsx$/.test(path)\n  );\n\n  for (const path of paths) {\n    const source = await readRepoFile(path);\n    if (/<select\\b/.test(source)) {\n      addFailure(\n        path,\n        'native select is not allowed in mobile product UI; use the shared @lcl/ui SelectField listbox'\n      );\n    }\n  }\n};\n"""
text = replace_once(text, old, new, 'UX native select gate')
text = replace_once(
    text,
    'await checkSelectControlPatterns();',
    'await checkNativeSelectPatterns();',
    'UX native select gate invocation',
)
ux_path.write_text(text)

# Tests: interact with the shared listbox instead of dispatching change on native selects.
test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
text = test_path.read_text()
insert_after = """const renderHardwareSetup = (props: Parameters<typeof HardwareSetupScreen>[0] = {}) => {\n  const queryClient = new QueryClient({\n    defaultOptions: {\n      queries: { retry: false },\n      mutations: { retry: false }\n    }\n  });\n\n  return render(\n    <QueryClientProvider client={queryClient}>\n      <I18nProvider>\n        <HardwareSetupScreen {...props} />\n      </I18nProvider>\n    </QueryClientProvider>\n  );\n};\n"""
helper = insert_after + """\nconst chooseSelectField = (\n  label: string,\n  optionLabel: string,\n  container: HTMLElement = document.body\n) => {\n  const scope = within(container);\n  fireEvent.click(scope.getByRole('button', { name: label }));\n  const listbox = scope.getByRole('listbox', { name: label });\n  fireEvent.click(within(listbox).getByRole('option', { name: optionLabel }));\n};\n"""
text = replace_once(text, insert_after, helper, 'test chooseSelectField helper insertion')
old = """  fireEvent.change(within(addDialog).getByLabelText('Typ termometru'), {\n    target: { value: profile }\n  });\n"""
new = """  chooseSelectField(\n    'Typ termometru',\n    profile === 'tp357_custom_v1' ? 'TP357' : 'Xiaomi/PVVX BTHome v2',\n    addDialog\n  );\n"""
text = replace_once(text, old, new, 'addSensorThroughUi profile selection')

mode_labels = {
    'heating': 'Grzanie',
    'cooling': 'Chłodzenie',
    'humidifying': 'Nawilżanie',
    'dehumidifying': 'Osuszanie',
}
pattern = re.compile(
    r"fireEvent\.change\(screen\.getByLabelText\('Tryb reguły'\), \{\s*target: \{ value: '([^']+)' \}\s*\}\);"
)

def replace_mode(match: re.Match[str]) -> str:
    mode = match.group(1)
    label = mode_labels.get(mode)
    if label is None:
        raise SystemExit(f'unknown rule mode in test: {mode}')
    return f"chooseSelectField('Tryb reguły', '{label}');"

text, mode_count = pattern.subn(replace_mode, text)
if mode_count < 2:
    raise SystemExit(f'expected at least two rule mode test migrations, found {mode_count}')

# Keep value assertions meaningful for button-backed SelectField triggers.
for label in ('Gniazdko Shelly', 'Termometr', 'Tryb reguły', 'Typ termometru'):
    text = re.sub(
        rf"(getByLabelText\('{re.escape(label)}'\)\))\.toHaveValue\(([^)]+)\)",
        rf"\1.toHaveAttribute('value', \2)",
        text,
    )

# One direct TP357 profile-change regression outside the helper exists in the setup suite.
text = text.replace(
    """    fireEvent.change(within(sensorAddDialog).getByLabelText('Typ termometru'), {\n      target: { value: 'tp357_custom_v1' }\n    });\n""",
    """    chooseSelectField('Typ termometru', 'TP357', sensorAddDialog);\n""",
)

test_path.write_text(text)

# Final structural guard before expensive tests.
production_selects = []
for path in Path('apps/mobile/src').rglob('*.tsx'):
    if '__tests__' in path.parts or path.name.endswith(('.test.tsx', '.spec.tsx')):
        continue
    if '<select' in path.read_text():
        production_selects.append(str(path))
if production_selects:
    raise SystemExit(f"native selects remain: {production_selects}")

print('Migrated all mobile native selects to shared SelectField and updated UX gate/tests')
