from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"missing expected block in {path}: {old[:100]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one match in {path}, got {text.count(old)}")
    target.write_text(text.replace(old, new, 1))

# Tokenize the shared fresh-reading pulse duration.
replace_once(
    "packages/design-tokens/src/index.ts",
    "  motion: {\n    fast: '120ms',\n    normal: '180ms'\n  },",
    "  motion: {\n    fast: '120ms',\n    normal: '180ms',\n    readingPulse: '650ms'\n  },",
)
replace_once(
    "packages/design-tokens/src/styles.css",
    "  --lcl-motion-fast: 120ms;\n  --lcl-motion-normal: 180ms;",
    "  --lcl-motion-fast: 120ms;\n  --lcl-motion-normal: 180ms;\n  --lcl-motion-reading-pulse: 650ms;",
)
replace_once(
    "apps/mobile/src/theme/theme.css",
    "  animation: sensor-card-reading-pulse 650ms ease-out;",
    "  animation: sensor-card-reading-pulse var(--lcl-motion-reading-pulse) ease-out;",
)

# Climate card: physical device identity is always Plug; persistent color is relay state.
replace_once(
    "apps/mobile/src/screens/AutomationDashboardScreen.tsx",
    "  IconPlug,\n  IconPlus,\n  IconTemperature\n} from '@tabler/icons-react';",
    "  IconPlug,\n  IconPlus\n} from '@tabler/icons-react';",
)
replace_once(
    "apps/mobile/src/screens/AutomationDashboardScreen.tsx",
    "  const lastSeenUptimeMs = snapshot?.diagnostics.lastSeenUptimeMs ?? null;\n  const previousLastSeenUptimeMsRef = useRef<number | null>(lastSeenUptimeMs);\n  const readingPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);",
    "  const lastSeenUptimeMs = snapshot?.diagnostics.lastSeenUptimeMs ?? null;\n  const currentUptimeMs =\n    snapshot?.time.uptimeSec != null && Number.isFinite(snapshot.time.uptimeSec)\n      ? snapshot.time.uptimeSec * 1000\n      : null;\n  const previousReadingRef = useRef<{\n    lastSeenUptimeMs: number;\n    currentUptimeMs: number | null;\n  } | null>(null);\n  const readingPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);",
)
replace_once(
    "apps/mobile/src/screens/AutomationDashboardScreen.tsx",
    "  useEffect(() => {\n    if (lastSeenUptimeMs === null) return;\n\n    const previousLastSeenUptimeMs = previousLastSeenUptimeMsRef.current;\n    if (\n      previousLastSeenUptimeMs !== null &&\n      lastSeenUptimeMs === previousLastSeenUptimeMs\n    ) {\n      return;\n    }\n\n    previousLastSeenUptimeMsRef.current = lastSeenUptimeMs;\n    setReadingPulseSequence((current) => current + 1);\n    setIsReadingPulseActive(true);",
    "  useEffect(() => {\n    if (lastSeenUptimeMs === null) return;\n\n    const previousReading = previousReadingRef.current;\n    previousReadingRef.current = { lastSeenUptimeMs, currentUptimeMs };\n    if (previousReading === null) return;\n\n    const runtimeRestarted =\n      previousReading.currentUptimeMs !== null &&\n      currentUptimeMs !== null &&\n      currentUptimeMs < previousReading.currentUptimeMs;\n    if (runtimeRestarted || lastSeenUptimeMs <= previousReading.lastSeenUptimeMs) return;\n\n    setReadingPulseSequence((current) => current + 1);\n    setIsReadingPulseActive(true);",
)
replace_once(
    "apps/mobile/src/screens/AutomationDashboardScreen.tsx",
    "  }, [lastSeenUptimeMs]);",
    "  }, [currentUptimeMs, lastSeenUptimeMs]);",
)
replace_once(
    "apps/mobile/src/screens/AutomationDashboardScreen.tsx",
    "          className={`automation-card__leading-icon${\n            automationRunning ? ' automation-card__leading-icon--active' : ''\n          }${isReadingPulseActive ? ' automation-card__leading-icon--fresh' : ''}`}\n          aria-hidden=\"true\"\n        >\n          <IconTemperature key={readingPulseSequence} className=\"automation-card__icon\" />",
    "          className={`automation-card__leading-icon${\n            relayState === true ? ' automation-card__leading-icon--active' : ''\n          }${isReadingPulseActive ? ' automation-card__leading-icon--fresh' : ''}`}\n          aria-hidden=\"true\"\n        >\n          <IconPlug key={readingPulseSequence} className=\"automation-card__icon\" />",
)

# Pulse preserves the relay-derived baseline color and uses only design tokens.
replace_once(
    "apps/mobile/src/screens/AutomationDashboardScreen.css",
    ".automation-card__leading-icon--fresh .automation-card__icon {\n  animation: automation-card-reading-pulse 650ms ease-out;\n}\n\n@keyframes automation-card-reading-pulse {\n  0%,\n  100% {\n    color: var(--lcl-color-accent);\n  }\n  45% {\n    color: var(--lcl-color-accent-strong);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .automation-card__leading-icon--fresh .automation-card__icon {\n    animation: none;\n    color: var(--lcl-color-accent);\n  }\n}",
    ".automation-card__leading-icon--fresh:not(.automation-card__leading-icon--active)\n  .automation-card__icon {\n  animation: automation-card-reading-pulse-off var(--lcl-motion-reading-pulse) ease-out;\n}\n\n.automation-card__leading-icon--fresh.automation-card__leading-icon--active\n  .automation-card__icon {\n  animation: automation-card-reading-pulse-on var(--lcl-motion-reading-pulse) ease-out;\n}\n\n@keyframes automation-card-reading-pulse-off {\n  0%,\n  100% {\n    color: var(--lcl-color-text-muted);\n  }\n  45% {\n    color: var(--lcl-color-accent);\n  }\n}\n\n@keyframes automation-card-reading-pulse-on {\n  0%,\n  100% {\n    color: var(--lcl-color-accent);\n  }\n  45% {\n    color: var(--lcl-color-accent-strong);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .automation-card__leading-icon--fresh:not(.automation-card__leading-icon--active)\n    .automation-card__icon,\n  .automation-card__leading-icon--fresh.automation-card__leading-icon--active\n    .automation-card__icon {\n    animation: none;\n  }\n}",
)

# Time automation is still a physical plug: show the same relay-colored plug identity.
replace_once(
    "apps/mobile/src/screens/TimeAutomationCard.tsx",
    "import { IconChevronRight } from '@tabler/icons-react';",
    "import { IconChevronRight, IconPlug } from '@tabler/icons-react';",
)
replace_once(
    "apps/mobile/src/screens/TimeAutomationCard.tsx",
    "      <header className=\"automation-card__header\">\n        <div className=\"automation-card__identity\">",
    "      <header className=\"automation-card__header\">\n        <span\n          className={`automation-card__leading-icon${\n            query.data?.relayOn === true ? ' automation-card__leading-icon--active' : ''\n          }`}\n          aria-hidden=\"true\"\n        >\n          <IconPlug className=\"automation-card__icon\" />\n        </span>\n        <div className=\"automation-card__identity\">",
)

# Focused tests: physical identity, relay color semantics, fresh data pulse, and time card consistency.
replace_once(
    "apps/mobile/src/__tests__/automation-dashboard.test.tsx",
    "    expect(screen.getByText('Salon')).toBeVisible();\n    expect(screen.queryByText('Działa')).toBeNull();",
    "    expect(screen.getByText('Salon')).toBeVisible();\n    const climateCard = screen.getByText('Salon').closest('article') as HTMLElement;\n    const climateLeadingIcon = climateCard.querySelector('.automation-card__leading-icon');\n    expect(climateLeadingIcon?.querySelector('.tabler-icon-plug')).not.toBeNull();\n    expect(climateLeadingIcon?.querySelector('.tabler-icon-temperature')).toBeNull();\n    expect(climateLeadingIcon).toHaveClass('automation-card__leading-icon--active');\n    expect(screen.queryByText('Działa')).toBeNull();",
)
replace_once(
    "apps/mobile/src/__tests__/automation-dashboard.test.tsx",
    "  it('pulses only the climate symbol when a fresh runtime measurement arrives', async () => {",
    "  it('pulses only the plug symbol when a fresh climate measurement arrives', async () => {",
)
replace_once(
    "apps/mobile/src/__tests__/automation-dashboard.test.tsx",
    "    expect(leadingIcon).not.toBeNull();\n    await waitFor(() =>\n      expect(leadingIcon).toHaveClass('automation-card__leading-icon--fresh')\n    );\n    await act(async () => {\n      await new Promise((resolve) => setTimeout(resolve, CLIMATE_PULSE_TEST_WAIT_MS));\n    });\n    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');\n\n    lastSeenUptimeMs = 12_330_000;",
    "    expect(leadingIcon).not.toBeNull();\n    expect(leadingIcon?.querySelector('.tabler-icon-plug')).not.toBeNull();\n    expect(leadingIcon?.querySelector('.tabler-icon-temperature')).toBeNull();\n    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');\n\n    lastSeenUptimeMs = 12_330_000;",
)
replace_once(
    "apps/mobile/src/__tests__/automation-dashboard.test.tsx",
    "    await waitFor(() =>\n      expect(leadingIcon).toHaveClass('automation-card__leading-icon--fresh')\n    );\n    expect(leadingIcon?.querySelector('.automation-card__icon')).not.toBeNull();",
    "    await waitFor(() =>\n      expect(leadingIcon).toHaveClass('automation-card__leading-icon--fresh')\n    );\n    expect(leadingIcon?.querySelector('.automation-card__icon')).not.toBeNull();\n    await act(async () => {\n      await new Promise((resolve) => setTimeout(resolve, CLIMATE_PULSE_TEST_WAIT_MS));\n    });\n    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');",
)
replace_once(
    "apps/mobile/src/__tests__/automation-dashboard.test.tsx",
    "    expect(await screen.findByText('Działa')).toBeVisible();\n    expect(screen.getByText('ON')).toBeVisible();",
    "    expect(await screen.findByText('Działa')).toBeVisible();\n    expect(screen.getByText('ON')).toBeVisible();\n    const timeCard = screen.getByText('Lampa').closest('article') as HTMLElement;\n    const timeLeadingIcon = timeCard.querySelector('.automation-card__leading-icon');\n    expect(timeLeadingIcon?.querySelector('.tabler-icon-plug')).not.toBeNull();\n    expect(timeLeadingIcon).toHaveClass('automation-card__leading-icon--active');",
)

print('Unified plug card identity, relay color semantics, fresh-reading pulse, and motion token')
