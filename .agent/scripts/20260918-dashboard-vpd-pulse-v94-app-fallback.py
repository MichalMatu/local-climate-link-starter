from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement anchor in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))

unit_test = "apps/mobile/src/__tests__/automation-dashboard.test.tsx"
replace_once(
    unit_test,
    """  effectiveOnThreshold = 19,\n  effectiveOffThreshold = 20,\n  dataState = 'ok'\n}: {\n  lastSeenUptimeMs?: number;\n  uptimeSec?: number;\n  effectiveOnThreshold?: number;\n  effectiveOffThreshold?: number;\n  dataState?: string;\n""",
    """  effectiveOnThreshold = 19,\n  effectiveOffThreshold = 20,\n  lastVpd = 1.31,\n  dataState = 'ok'\n}: {\n  lastSeenUptimeMs?: number;\n  uptimeSec?: number;\n  effectiveOnThreshold?: number;\n  effectiveOffThreshold?: number;\n  lastVpd?: number | null;\n  dataState?: string;\n"""
)
replace_once(
    unit_test,
    """    21.4,\n    1.31,\n    effectiveOnThreshold,\n""",
    """    21.4,\n    lastVpd,\n    effectiveOnThreshold,\n"""
)
replace_once(
    unit_test,
    """  it('shows the VPD target inline only while VPD assist is enabled', async () => {\n""",
    """  it('derives current VPD from runtime temperature and humidity when Shelly omits it', async () => {\n    useInstalledAutomationStore.getState().upsertInstallation(installedAutomation());\n    vi.stubGlobal(\n      'fetch',\n      vi.fn(async () => jsonResponse(diagnosticPayload({ lastVpd: null })))\n    );\n\n    renderDashboard();\n\n    expect(await screen.findByText('1.14 kPa')).toBeVisible();\n  });\n\n  it('shows the VPD target inline only while VPD assist is enabled', async () => {\n"""
)

doc = "docs/prompts/continue-e2e-freeze.md"
replace_once(
    doc,
    "- VPD ranges/configuration stay unchanged. With VPD assist OFF, runtime intentionally reports lastVpd=null and dashboard shows `—`; that is not a bug.\n",
    "- VPD ranges/configuration stay unchanged. Minimal/older runtime may report lastVpd=null with VPD assist OFF; the dashboard derives current VPD from runtime temperature/humidity, while the target is shown only when VPD assist is enabled.\n"
)

print('Added backward-compatible app-side VPD fallback without growing the Shelly runtime')
