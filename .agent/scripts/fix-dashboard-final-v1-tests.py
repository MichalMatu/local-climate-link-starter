from pathlib import Path

ROOT = Path('.')


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} occurrences, found {actual}: {old[:120]!r}')
    p.write_text(text.replace(old, new))

# Preserve the most specific runtime warning. If diagnostics succeeded and say
# the sensor data is stale, do not replace that useful state with a generic
# control-query attention badge.
replace_exact(
    'apps/mobile/src/screens/AutomationDashboardScreen.tsx',
    "  } else if (query.isError || control.isError) {\n    warningLabel = t('dashboard.health.attention');\n  } else if (health !== null && health !== 'ok') {\n    warningLabel = installationHealthLabel(health, t);\n    warningClass = health;\n  }",
    "  } else if (health !== null && health !== 'ok') {\n    warningLabel = installationHealthLabel(health, t);\n    warningClass = health;\n  } else if (query.isError || control.isError) {\n    warningLabel = t('dashboard.health.attention');\n  }"
)

# The no-manual-refresh test must wait for React Query to publish the refetched
# state to React before asserting that the warning disappeared.
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    "import { cleanup, fireEvent, render, screen } from '@testing-library/react';",
    "import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';"
)
replace_exact(
    'apps/mobile/src/__tests__/automation-dashboard.test.tsx',
    "    expect(screen.queryByText('Wymaga uwagi')).toBeNull();\n    expect(screen.getByText('19.25°C / 19.75°C')).toBeVisible();",
    "    await waitFor(() => expect(screen.queryByText('Wymaga uwagi')).toBeNull());\n    expect(screen.getByText('19.25°C / 19.75°C')).toBeVisible();"
)

# AppRoutes now legitimately coexists with the Dashboard app-state refresh
# listener. Keep the Android-back mock event-specific so appStateChange cannot
# overwrite the back callback, and assert the listener by event name instead
# of total addListener call count.
replace_exact(
    'apps/mobile/src/__tests__/app-routes.test.tsx',
    "const nativeAppMocks = vi.hoisted(() => {\n  let backListener: (() => void) | undefined;\n  const removeListener = vi.fn(async () => undefined);\n  const addListener = vi.fn(async (_eventName: string, listener: () => void) => {\n    backListener = listener;\n    return { remove: removeListener };\n  });",
    "const nativeAppMocks = vi.hoisted(() => {\n  let backListener: (() => void) | undefined;\n  const removeListener = vi.fn(async () => undefined);\n  const addListener = vi.fn(async (eventName: string, listener: () => void) => {\n    if (eventName === 'backButton') {\n      backListener = listener;\n    }\n    return { remove: removeListener };\n  });"
)
replace_exact(
    'apps/mobile/src/__tests__/app-routes.test.tsx',
    "await waitFor(() => expect(nativeAppMocks.addListener).toHaveBeenCalledTimes(1));",
    "await waitFor(() =>\n      expect(nativeAppMocks.addListener).toHaveBeenCalledWith('backButton', expect.any(Function))\n    );",
    count=3
)

print('dashboard final v1 regression fixes applied')
