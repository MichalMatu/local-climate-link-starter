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
    """  cleanup,\n  fireEvent,\n  render,\n""",
    """  act,\n  cleanup,\n  fireEvent,\n  render,\n"""
)
replace_once(
    unit_test,
    """    await new Promise((resolve) => setTimeout(resolve, CLIMATE_PULSE_TEST_WAIT_MS));\n    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');\n\n    lastSeenUptimeMs = 12_330_000;\n    await queryClient.refetchQueries({\n      predicate: (query) => query.queryKey[0] === 'installed-automation-diagnostics'\n    });\n""",
    """    await act(async () => {\n      await new Promise((resolve) => setTimeout(resolve, CLIMATE_PULSE_TEST_WAIT_MS));\n    });\n    expect(leadingIcon).not.toHaveClass('automation-card__leading-icon--fresh');\n\n    lastSeenUptimeMs = 12_330_000;\n    await act(async () => {\n      await queryClient.refetchQueries({\n        predicate: (query) => query.queryKey[0] === 'installed-automation-diagnostics'\n      });\n    });\n"""
)

e2e = "apps/mobile/e2e/responsive.spec.ts"
replace_once(
    e2e,
    """    await expect(page.getByRole('heading', { name: 'Gniazdka' })).toBeVisible();\n    await expect(page.getByText('Salon')).toBeVisible();\n""",
    """    await expect(page.getByRole('main', { name: 'Gniazdka' })).toBeVisible();\n    await expect(page.getByRole('heading', { name: 'Gniazdka' })).toHaveCount(0);\n    await expect(page.getByText('Salon')).toBeVisible();\n"""
)

print('Fixed fresh-reading test act boundaries and aligned responsive E2E with current dashboard hierarchy')
