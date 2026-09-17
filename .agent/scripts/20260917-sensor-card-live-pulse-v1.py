from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, got {count}")
    file.write_text(text.replace(old, new, 1))


presentation = "apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx"
theme = "apps/mobile/src/theme/theme.css"
test_path = Path(
    "apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.test.tsx"
)

replace_once(
    presentation,
    """  IconPlug,\n  IconTrash,\n  IconWifi\n} from '@tabler/icons-react';\nimport { useId } from 'react';""",
    """  IconPlug,\n  IconTemperature,\n  IconTrash,\n  IconWifi\n} from '@tabler/icons-react';\nimport { useEffect, useId, useRef, useState } from 'react';""",
)

replace_once(
    presentation,
    """const latestSample = (\n  samples: readonly SensorReadingSample[]\n): SensorReadingSample | null => samples.at(-1) ?? null;\n""",
    """const latestSample = (\n  samples: readonly SensorReadingSample[]\n): SensorReadingSample | null => samples.at(-1) ?? null;\n\nconst SENSOR_SAMPLE_PULSE_MS = 650;\n""",
)

replace_once(
    presentation,
    """  const latest = latestSample(samples);\n  const batterySample = latestBatterySample(samples);\n  const rssiSample = latestNumericSample(samples, 'rssi');\n\n  return (""",
    """  const latest = latestSample(samples);\n  const latestSeenAtMs = latest?.seenAtMs ?? null;\n  const previousSeenAtMsRef = useRef<number | null>(latestSeenAtMs);\n  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const [isSamplePulseActive, setIsSamplePulseActive] = useState(false);\n  const batterySample = latestBatterySample(samples);\n  const rssiSample = latestNumericSample(samples, 'rssi');\n\n  useEffect(() => {\n    if (latestSeenAtMs === null) return;\n\n    const previousSeenAtMs = previousSeenAtMsRef.current;\n    if (previousSeenAtMs !== null && latestSeenAtMs <= previousSeenAtMs) return;\n\n    previousSeenAtMsRef.current = latestSeenAtMs;\n    setIsSamplePulseActive(true);\n    if (pulseTimeoutRef.current !== null) clearTimeout(pulseTimeoutRef.current);\n    pulseTimeoutRef.current = setTimeout(() => {\n      setIsSamplePulseActive(false);\n      pulseTimeoutRef.current = null;\n    }, SENSOR_SAMPLE_PULSE_MS);\n  }, [latestSeenAtMs]);\n\n  useEffect(\n    () => () => {\n      if (pulseTimeoutRef.current !== null) clearTimeout(pulseTimeoutRef.current);\n    },\n    []\n  );\n\n  return (""",
)

replace_once(
    presentation,
    """    <article className=\"saved-list__item sensor-saved-card\">\n      <div className=\"sensor-card-header\">\n        {isEditing ? (""",
    """    <article className=\"saved-list__item sensor-saved-card\">\n      <div className=\"sensor-card-header\">\n        <span\n          className={`sensor-card-leading-icon${\n            isSamplePulseActive ? ' sensor-card-leading-icon--fresh' : ''\n          }`}\n          aria-hidden=\"true\"\n        >\n          <IconTemperature className=\"sensor-card-leading-icon__icon\" />\n        </span>\n        {isEditing ? (""",
)

replace_once(
    theme,
    """.sensor-card-header {\n  align-items: center;\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  grid-template-columns: minmax(0, 1fr) auto;\n}\n\n.sensor-card-title-row,""",
    """.sensor-card-header {\n  align-items: center;\n  display: grid;\n  gap: var(--lcl-spacing-sm);\n  grid-template-columns: var(--lcl-size-control-min-height) minmax(0, 1fr) auto;\n}\n\n.sensor-card-leading-icon {\n  align-items: center;\n  background: var(--lcl-color-surface-muted);\n  border-radius: var(--lcl-radius-round);\n  color: var(--lcl-color-text-muted);\n  display: inline-flex;\n  height: var(--lcl-size-control-min-height);\n  justify-content: center;\n  width: var(--lcl-size-control-min-height);\n}\n\n.sensor-card-leading-icon__icon {\n  height: var(--lcl-size-control-icon-size);\n  width: var(--lcl-size-control-icon-size);\n}\n\n.sensor-card-leading-icon--fresh {\n  animation: sensor-card-reading-pulse 650ms ease-out;\n}\n\n@keyframes sensor-card-reading-pulse {\n  0%,\n  100% {\n    background: var(--lcl-color-surface-muted);\n    color: var(--lcl-color-text-muted);\n    transform: scale(1);\n  }\n\n  40% {\n    background: var(--lcl-color-accent);\n    color: var(--lcl-color-accent-contrast);\n    transform: scale(1.06);\n  }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .sensor-card-leading-icon--fresh {\n    animation: none;\n    color: var(--lcl-color-accent);\n  }\n}\n\n.sensor-card-title-row,""",
)

if test_path.exists():
    raise SystemExit(f"{test_path}: already exists")

test_path.write_text(
    """import { act, cleanup, render } from '@testing-library/react';\nimport { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';\nimport { I18nProvider, setLocalePreference } from '../../../app/i18n.js';\nimport type { SensorReadingSample } from '../../../flows/hardware-setup/sensorReadingsStore.js';\nimport { SavedSensorCard } from './SensorSetupPresentation.js';\n\nconst device = {\n  id: 'sensor-a4c1384f24cd',\n  name: 'Xiaomi salon',\n  runtimeAddress: 'A4:C1:38:4F:24:CD',\n  profileId: 'xiaomi_lywsd03mmc_bthome_v2' as const\n};\n\nconst sample = (seenAtMs: number): SensorReadingSample => ({\n  sensorId: device.runtimeAddress,\n  source: 'phone-scan',\n  temperatureC: 21.3,\n  humidityPct: 45.7,\n  rssi: -58,\n  seenAtMs\n});\n\nconst card = (samples: readonly SensorReadingSample[]) => (\n  <I18nProvider>\n    <SavedSensorCard\n      device={device}\n      samples={samples}\n      isEditing={false}\n      pvvxTimePending={false}\n      onEditStart={vi.fn()}\n      onEditEnd={vi.fn()}\n      onNameChange={vi.fn()}\n      onPvvxSetTime={vi.fn()}\n      onRemove={vi.fn()}\n    />\n  </I18nProvider>\n);\n\ndescribe('SavedSensorCard live sample affordance', () => {\n  beforeEach(() => {\n    setLocalePreference('pl');\n    vi.useFakeTimers();\n  });\n\n  afterEach(() => {\n    cleanup();\n    vi.useRealTimers();\n  });\n\n  it('shows the thermometer leading icon without pulsing on mount', () => {\n    const { container } = render(card([sample(1000)]));\n    const icon = container.querySelector('.sensor-card-leading-icon');\n\n    expect(icon).not.toBeNull();\n    expect(icon).not.toHaveClass('sensor-card-leading-icon--fresh');\n  });\n\n  it('pulses only when seenAtMs strictly advances', () => {\n    const { container, rerender } = render(card([sample(1000)]));\n    const leadingIcon = () => container.querySelector('.sensor-card-leading-icon');\n\n    rerender(card([sample(1000)]));\n    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');\n\n    rerender(card([sample(999)]));\n    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');\n\n    rerender(card([sample(1001)]));\n    expect(leadingIcon()).toHaveClass('sensor-card-leading-icon--fresh');\n\n    act(() => vi.advanceTimersByTime(700));\n    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');\n  });\n\n  it('pulses when the first sample arrives after an empty mounted card', () => {\n    const { container, rerender } = render(card([]));\n    const leadingIcon = () => container.querySelector('.sensor-card-leading-icon');\n\n    expect(leadingIcon()).not.toHaveClass('sensor-card-leading-icon--fresh');\n    rerender(card([sample(1000)]));\n    expect(leadingIcon()).toHaveClass('sensor-card-leading-icon--fresh');\n  });\n});\n"""
)
