from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement anchor in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_all_exact(path: str, old: str, new: str, expected: int) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"unexpected replacement count in {path}: expected {expected}, got {count}")
    file.write_text(text.replace(old, new))

# Runtime: VPD is a measurement, not an assist-only value. Keep target/threshold assist gated.
generator = "packages/script-generator/src/shelly/generate.ts"
replace_once(
    generator,
    """  if (!config.rule.vpdAssist.enabled) {\n    return 'function th(t,h){return{o:C.on,f:C.off};}';\n  }\n""",
    """  if (!config.rule.vpdAssist.enabled) {\n    return `function sv(t){return 0.6108*Math.exp((17.27*t)/(t+237.3));}\nfunction vd(t,h){return t===null||h===null?null:sv(t)*(1-h/100);}\nfunction th(t,h){return{o:C.on,f:C.off};}`;\n  }\n"""
)
replace_once(
    generator,
    'R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=',
    'R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=vd(t,h);var go='
)

runtime_test = "packages/script-generator/src/__tests__/runtime-matrix.test.ts"
replace_once(
    runtime_test,
    """  it.each(matrixCases)('adds VPD code only when requested for $label', (matrixCase) => {\n    const script = generateShellyThermostatScript(configForCase(matrixCase));\n\n    if (matrixCase.vpdAssistEnabled) {\n      expect(script).toContain('\"vp\":1.25');\n      expect(script).toContain('function sv(t)');\n      expect(script).toContain('Math.exp');\n    } else {\n      expect(script).toContain('\"vp\":0');\n      expect(script).not.toContain('function sv(t)');\n      expect(script).not.toContain('Math.exp');\n    }\n  });\n""",
    """  it.each(matrixCases)(\n    'keeps VPD measurement available while gating assist-only threshold code for $label',\n    (matrixCase) => {\n      const script = generateShellyThermostatScript(configForCase(matrixCase));\n\n      expect(script).toContain('function sv(t)');\n      expect(script).toContain('function vd(t,h)');\n      expect(script).toContain('Math.exp');\n      expect(script).toContain('R.vp=vd(t,h)');\n      if (matrixCase.vpdAssistEnabled) {\n        expect(script).toContain('\"vp\":1.25');\n        expect(script).toContain('function vt(h)');\n        expect(script).toContain('function vh(t)');\n      } else {\n        expect(script).toContain('\"vp\":0');\n        expect(script).not.toContain('function vt(h)');\n        expect(script).not.toContain('function vh(t)');\n      }\n    }\n  );\n"""
)

presentation = "apps/mobile/src/flows/installations/presentation.ts"
replace_once(
    presentation,
    """export const formatInstallationMetric = (\n  value: number | null | undefined,\n  unit: string,\n  digits = 1\n): string =>\n  value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}${unit}`;\n\n""",
    """export const formatInstallationMetric = (\n  value: number | null | undefined,\n  unit: string,\n  digits = 1\n): string =>\n  value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}${unit}`;\n\nexport const formatInstallationVpd = (\n  currentVpdKpa: number | null | undefined,\n  targetVpdKpa?: number | null\n): string => {\n  if (currentVpdKpa == null || !Number.isFinite(currentVpdKpa)) return '—';\n  const current = currentVpdKpa.toFixed(2);\n  return targetVpdKpa != null && Number.isFinite(targetVpdKpa)\n    ? `${current} → ${targetVpdKpa.toFixed(2)} kPa`\n    : `${current} kPa`;\n};\n\n"""
)

dashboard = "apps/mobile/src/screens/AutomationDashboardScreen.tsx"
replace_once(
    dashboard,
    "import { App as CapacitorApp } from '@capacitor/app';\n",
    "import { App as CapacitorApp } from '@capacitor/app';\nimport { calculateVpdKpa } from '@lcl/automation-core';\n"
)
replace_once(
    dashboard,
    "import { useCallback, useEffect, useState } from 'react';",
    "import { useCallback, useEffect, useRef, useState } from 'react';"
)
replace_once(
    dashboard,
    """  formatInstallationMetric,\n  installationHealthLabel,\n  installationThresholdSummary\n""",
    """  formatInstallationMetric,\n  formatInstallationVpd,\n  installationHealthLabel,\n  installationThresholdSummary\n"""
)
replace_once(
    dashboard,
    """const formatPlugEnergy = (value: number | null | undefined): string => {\n  if (value == null || !Number.isFinite(value)) return '—';\n  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;\n};\n\n""",
    """const formatPlugEnergy = (value: number | null | undefined): string => {\n  if (value == null || !Number.isFinite(value)) return '—';\n  return value >= 1000 ? `${(value / 1000).toFixed(2)} kWh` : `${value.toFixed(0)} Wh`;\n};\n\nconst CLIMATE_READING_PULSE_MS = 650;\n\n"""
)
replace_once(
    dashboard,
    """  const query = useInstalledAutomationDiagnostics(installation);\n  const control = useInstalledAutomationControl(installation);\n  const action = useInstalledAutomationActions(installation);\n\n  const snapshot = query.data;\n""",
    """  const query = useInstalledAutomationDiagnostics(installation);\n  const control = useInstalledAutomationControl(installation);\n  const action = useInstalledAutomationActions(installation);\n\n  const snapshot = query.data;\n  const lastSeenUptimeMs = snapshot?.diagnostics.lastSeenUptimeMs ?? null;\n  const previousLastSeenUptimeMsRef = useRef<number | null>(lastSeenUptimeMs);\n  const readingPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const [isReadingPulseActive, setIsReadingPulseActive] = useState(false);\n  const [readingPulseSequence, setReadingPulseSequence] = useState(0);\n\n  useEffect(() => {\n    if (lastSeenUptimeMs === null) return;\n\n    const previousLastSeenUptimeMs = previousLastSeenUptimeMsRef.current;\n    if (\n      previousLastSeenUptimeMs !== null &&\n      lastSeenUptimeMs === previousLastSeenUptimeMs\n    ) {\n      return;\n    }\n\n    previousLastSeenUptimeMsRef.current = lastSeenUptimeMs;\n    setReadingPulseSequence((current) => current + 1);\n    setIsReadingPulseActive(true);\n    if (readingPulseTimeoutRef.current !== null) {\n      clearTimeout(readingPulseTimeoutRef.current);\n    }\n    readingPulseTimeoutRef.current = setTimeout(() => {\n      setIsReadingPulseActive(false);\n      readingPulseTimeoutRef.current = null;\n    }, CLIMATE_READING_PULSE_MS);\n  }, [lastSeenUptimeMs]);\n\n  useEffect(\n    () => () => {\n      if (readingPulseTimeoutRef.current !== null) {\n        clearTimeout(readingPulseTimeoutRef.current);\n      }\n    },\n    []\n  );\n"""
)
replace_once(
    dashboard,
    """  const secondaryMetric = controlsHumidity\n    ? {\n        label: t('dashboard.temperature'),\n        value: formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')\n      }\n    : {\n        label: t('dashboard.humidity'),\n        value: formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')\n      };\n\n""",
    """  const secondaryMetric = controlsHumidity\n    ? {\n        label: t('dashboard.temperature'),\n        value: formatInstallationMetric(snapshot?.diagnostics.lastTemp, '°C')\n      }\n    : {\n        label: t('dashboard.humidity'),\n        value: formatInstallationMetric(snapshot?.diagnostics.lastHumidity, '%')\n      };\n  const currentVpdKpa =\n    snapshot?.diagnostics.lastVpd ??\n    calculateVpdKpa(\n      snapshot?.diagnostics.lastTemp ?? undefined,\n      snapshot?.diagnostics.lastHumidity ?? undefined\n    );\n  const targetVpdKpa = installation.config.rule.vpdAssist.enabled\n    ? installation.config.rule.vpdAssist.targetKpa\n    : null;\n\n"""
)
replace_once(
    dashboard,
    """          className={`automation-card__leading-icon${\n            automationRunning ? ' automation-card__leading-icon--active' : ''\n          }`}\n          aria-hidden=\"true\"\n        >\n          <IconTemperature className=\"automation-card__icon\" />\n""",
    """          className={`automation-card__leading-icon${\n            automationRunning ? ' automation-card__leading-icon--active' : ''\n          }${isReadingPulseActive ? ' automation-card__leading-icon--fresh' : ''}`}\n          aria-hidden=\"true\"\n        >\n          <IconTemperature\n            key={readingPulseSequence}\n            className=\"automation-card__icon\"\n          />\n"""
)
replace_once(
    dashboard,
    """            <strong>\n              {formatInstallationMetric(snapshot?.diagnostics.lastVpd, ' kPa', 2)}\n            </strong>\n""",
    """            <strong>{formatInstallationVpd(currentVpdKpa, targetVpdKpa)}</strong>\n"""
)

css = "apps/mobile/src/screens/AutomationDashboardScreen.css"
replace_once(
    css,
    """.automation-card__leading-icon--active {\n  color: var(--lcl-color-accent);\n}\n\n""",
    """.automation-card__leading-icon--active {\n  color: var(--lcl-color-accent);\n}\n\n.automation-card__leading-icon--fresh .automation-card__icon {\n  animation: automation-card-reading-pulse 650ms ease-out;\n}\n\n@keyframes automation-card-reading-pulse {\n  0%,\n  100% {\n    color: var(--lcl-color-accent);\n  }\n  45% {\n    color: var(--lcl-color-accent-strong);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .automation-card__leading-icon--fresh .automation-card__icon {\n    animation: none;\n    color: var(--lcl-color-accent);\n  }\n}\n\n"""
)

unit_test = "apps/mobile/src/__tests__/automation-dashboard.test.tsx"
replace_once(
    unit_test,
    "const installedAutomation = () => {",
    "const installedAutomation = (vpdAssistEnabled = false) => {"
)
replace_once(
    unit_test,
    """    config: {\n      ...base,\n      sensor: {\n""",
    """    config: {\n      ...base,\n      rule: {\n        ...base.rule,\n        vpdAssist: {\n          ...base.rule.vpdAssist,\n          enabled: vpdAssistEnabled\n        }\n      },\n      sensor: {\n"""
)
replace_once(
    unit_test,
    """  it('shows a native time schedule and opens it by stable installation id', async () => {\n""",
    """  it('shows the VPD target inline only while VPD assist is enabled', async () => {\n    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation(true));\n    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(diagnosticPayload())));\n\n    renderDashboard();\n\n    expect(await screen.findByText('1.31 → 1.20 kPa')).toBeVisible();\n    expect(screen.queryByText('1.31 kPa')).toBeNull();\n  });\n\n  it('pulses only the climate symbol when a fresh runtime measurement arrives', async () => {\n    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());\n    let lastSeenUptimeMs = 12_300_000;\n    vi.stubGlobal(\n      'fetch',\n      vi.fn(async () => jsonResponse(diagnosticPayload({ lastSeenUptimeMs })))\n    );\n\n    const { queryClient } = renderDashboard();\n    expect(await screen.findByText('21.4°C')).toBeVisible();\n    const leadingIcon = document.querySelector(\n      '.automation-card--climate .automation-card__leading-icon'\n    );\n    expect(leadingIcon).not.toBeNull();\n    await waitFor(() =>\n      expect(leadingIcon).toHaveClass('automation-card__leading-icon--fresh')\n    );\n    await new Promise((resolve) => setTimeout(resolve, CLIMATE_PULSE_TEST_WAIT_MS));\n    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');\n\n    lastSeenUptimeMs = 12_330_000;\n    await queryClient.refetchQueries({\n      predicate: (query) => query.queryKey[0] === 'installed-automation-diagnostics'\n    });\n    await waitFor(() =>\n      expect(leadingIcon).toHaveClass('automation-card__leading-icon--fresh')\n    );\n    expect(leadingIcon?.querySelector('.automation-card__icon')).not.toBeNull();\n  });\n\n  it('shows a native time schedule and opens it by stable installation id', async () => {\n"""
)
replace_once(
    unit_test,
    """const jsonResponse = (payload: unknown) =>\n  new Response(JSON.stringify(payload), {\n    status: 200,\n    headers: { 'content-type': 'application/json' }\n  });\n\n""",
    """const jsonResponse = (payload: unknown) =>\n  new Response(JSON.stringify(payload), {\n    status: 200,\n    headers: { 'content-type': 'application/json' }\n  });\n\nconst CLIMATE_PULSE_TEST_WAIT_MS = 700;\n\n"""
)

# Exercise the narrowest viewport with VPD target text and existing overflow assertion.
e2e = "apps/mobile/e2e/responsive.spec.ts"
replace_once(
    e2e,
    "vpdAssist: { enabled: false, targetKpa: 1.2 },",
    "vpdAssist: { enabled: true, targetKpa: 1.2 },"
)
replace_once(
    e2e,
    "await expect(page.getByText('1.31 kPa')).toBeVisible();",
    "await expect(page.getByText('1.31 → 1.20 kPa')).toBeVisible();"
)

print('Applied always-on VPD, inline target, and fresh-reading symbol pulse')
