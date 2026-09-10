from pathlib import Path

# 1. Remove the one real React act() warning from the route test.
test_path = Path('apps/mobile/src/__tests__/app-routes.test.tsx')
test = test_path.read_text()
old = """    useInstalledAutomationStore.getState().upsertInstallation(\n      createInstalledAutomation({\n        shelly: { id: 'shellyplugsg3-setup-complete', model: 'S3PL-00112EU', gen: 3 },\n        shellyName: 'Salon',\n        baseUrl: 'http://192.168.0.20/',\n        scriptId: 1,\n        scriptHash: 'lcl-setup-complete',\n        config,\n        nowMs: 1000\n      })\n    );\n\n    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));\n"""
new = """    act(() => {\n      useInstalledAutomationStore.getState().upsertInstallation(\n        createInstalledAutomation({\n          shelly: { id: 'shellyplugsg3-setup-complete', model: 'S3PL-00112EU', gen: 3 },\n          shellyName: 'Salon',\n          baseUrl: 'http://192.168.0.20/',\n          scriptId: 1,\n          scriptHash: 'lcl-setup-complete',\n          config,\n          nowMs: 1000\n        })\n      );\n    });\n\n    fireEvent.click(screen.getByRole('button', { name: 'mock-complete' }));\n"""
assert old in test, 'route test warning target not found'
test_path.write_text(test.replace(old, new, 1))

# 2. Architecture overview: current product/UI boundary, manual locale selection and refactor seam.
overview_path = Path('docs/architecture/overview.md')
overview = overview_path.read_text()
overview = overview.replace(
    '# Architecture overview\n\n## Purpose\n\nLocal Climate Link is a configurator for local BLE -> Shelly automations. The app helps the user set up a sensor and a Shelly Plug S Gen3 once. After setup, the Shelly Script is the runtime controller.\n',
    '# Architecture overview\n\n## Purpose\n\nLocal Climate Link is a configurator and management UI for local BLE -> Shelly climate automations plus simple Shelly-native time automations. The phone handles setup, status, management and diagnostics; after setup, runtime ownership stays on the Shelly device.\n'
)
overview = overview.replace(
    """MVP UI copy uses a lightweight app-level i18n layer in
`apps/mobile/src/app/i18n.ts`. The locale is resolved from the system
browser/webview language and applied to `document.documentElement.lang`.
Supported locales are Polish, English, German, Spanish, French, Italian, and
Brazilian Portuguese. Unsupported languages fall back to English, and generic
Portuguese tags resolve to `pt-BR`. The MVP UI intentionally has no manual
language switch.
""",
    """UI copy uses a lightweight app-level i18n layer in
`apps/mobile/src/app/i18n.ts`. The default locale follows the system
browser/webview language and is applied to `document.documentElement.lang`.
Supported locales are Polish, English, German, Spanish, French, Italian, and
Brazilian Portuguese. Unsupported languages fall back to English, and generic
Portuguese tags resolve to `pt-BR`. The full-page Settings screen can override
the system locale; that preference is persisted locally and can be returned to
`system` at any time.
"""
)
overview = overview.replace('## Data flow for MVP setup', '## Current setup/runtime data flow')
start = overview.index('## Current implementation boundary')
end = overview.index('## Safety boundary')
current_boundary = """## Current implementation boundary

The current mobile shell is intent-first rather than setup-tab-first. With no
saved installation it opens the goal chooser; with installed automations it
opens the Dashboard. Dashboard, installation detail, and the full-page Settings
screen share the bottom navigation (`Klimat / Czas / Ustawienia`). Settings owns
locale, appearance, and progressively disclosed service diagnostics.

Installed climate automations use a persistent per-installation model binding a
stable app installation id to Shelly identity/address, script identity/hash,
sensor identity and rule configuration. Dashboard/detail runtime state is read
from the Shelly controller rather than silently substituting phone BLE data.
Pure time automation uses native Shelly schedules and must not compete with a
climate script for the same relay.

The hardware setup flow remains available for real local setup and diagnostics:
manual Shelly checks, bounded LAN scanning, phone BLE, Shelly-side temporary BLE
discovery, PVVX operations, generated-script installation, safe relay testing,
and recovery. The demo adapters remain for hardware-free development; they are
not the runtime architecture.

Shelly LAN discovery belongs to the hardware setup flow, not directly to React
components. The flow builds the IPv4 candidate list, removes already saved Shelly
base URLs, scans the remaining addresses with bounded concurrency, and returns
only verified `Shelly.GetDeviceInfo` candidates to the UI. The UI presents those
candidates as direct add actions.

Real platform and Shelly access stay behind interfaces:

```text
packages/ble-core
  BleScanner port
  DemoBleScanner
  CapacitorBleScanner shell

packages/shelly-client
  ShellyClient port
  FetchShellyRpcTransport
  RpcShellyClient
  FakeShellyClient
```

Shelly-side BLE discovery is deliberately separate from runtime automation. The
app uploads `Local Climate Link BLE Discovery` as a temporary script, sets the
relay OFF before scanning, stops the main automation while discovery runs, polls
`/script/<id>/ble-scan`, and stops the discovery script when the modal closes.
If the automation script was running before discovery, the app starts it again
after the scan is closed.

## UI quality boundary

Mobile styling should use generated `--lcl-*` design tokens and shared classes.
Production mobile TSX must not introduce ad-hoc inline `style={{...}}` blocks or
hand-authored SVG icons; use real Tabler components for standard actions. The UX
quality gate enforces these rules together with tokenized colors, borders,
z-indexes, responsive behavior and modal sizing. `pnpm tokens:build` must remain
idempotent with no generated diff.

## Known refactor boundary

`ShellySetupPage` has been split so reusable/presentational Shelly formatting,
input UI and saved-device card rendering live in `ShellySetupPresentation.tsx`.
The remaining high-concentration seam is `useHardwareSetupFlow.ts`. It owns many
stateful hardware operations and safety-sensitive mutations, so it must not be
split merely to reduce file length. Future extractions should follow cohesive
runtime responsibilities while preserving the public flow contract and the
hardware regression suite. Preferred boundaries are:

```text
saved Shelly control/status mutations
Shelly BLE discovery session lifecycle
phone BLE live scan + PVVX GATT operations
installation/diagnostic orchestration
```

Do not mix such refactors with behavioral changes to relay safety, script
ownership, scan cleanup or installation verification.

"""
overview = overview[:start] + current_boundary + overview[end:]
overview_path.write_text(overview)

# 3. Repository guide: short-lived work branches and current top-level navigation.
guide_path = Path('docs/development/repository-guide.md')
guide = guide_path.read_text()
old_branch = """## Git branch model

`main` is the primary branch:

- All day-to-day development happens on `main`.
- Releases are prepared and tagged directly on `main` (normal semver tags like `v2.0.7`).
- GitHub Pages deployment and official GitHub Releases are built from `main`.

The `work` branch was a previous development branch. The old \"release-only snapshot on main, full history only on work\" model has been retired.

As of the v2.0.7 release, `main` contains the complete latest code (the content of the former `work` branch was merged in). From now on, treat `main` as the single source of truth for both development and releases.

Recommended workflow:

1. Work on `main` and run `pnpm check`.
2. For a release: bump versions, run `pnpm release:android`, then verify artifacts. `LCL_RELEASE_VERSION` is an optional explicit override; otherwise the root `package.json` version is used.
3. Push `main`, create GitHub Release + tag.
4. (optional) The `work` branch can be kept for reference or deleted if no longer needed.

CI runs on pushes and PRs targeting `main`. Pages deploy only from `main`.
"""
new_branch = """## Git branch model

`main` is the canonical product branch and the only long-lived source of truth
for development and releases. Releases are prepared/tagged from `main`, and
GitHub Pages / official GitHub Releases are built from it.

For substantial feature, UX, refactor, hardware or audit work, prefer a
short-lived `work/<topic>` branch created from the current `main`. Run focused
checks while iterating, then `pnpm check:full` before integration. Integrate only
verified history into `main` (fast-forward when possible, otherwise a reviewed
PR/merge), and delete the temporary `work/*` branch after the integrated SHA is
verified. Do not keep parallel long-lived development branches.

`agent-control` is control-plane state for Local Agent tasks and is not a product
development branch. A deliberately created `freeze/*` branch may be retained as
an immutable rollback/audit baseline; never develop on it.

Recommended workflow:

1. Start from current `main`; use a short-lived `work/<topic>` branch for substantial changes.
2. Run focused checks during iteration and `pnpm check:full` before integration.
3. Verify the exact integrated SHA on `main`, then remove the temporary work branch.
4. For a release: bump versions, run `pnpm release:android`, verify artifacts, then tag/release from `main`. `LCL_RELEASE_VERSION` is an optional explicit override; otherwise the root `package.json` version is used.

CI runs on pushes and PRs targeting `main`. Pages deploy only from `main`.
"""
assert old_branch in guide, 'branch model block not found'
guide = guide.replace(old_branch, new_branch, 1)
guide = guide.replace(
    """Quality gates:

```bash
pnpm quality:ux        # static UX/style guardrails
""",
    """Quality gates:

```bash
pnpm quality:ux        # static UX/style guardrails, including tokenization + mobile icon/style hygiene
"""
)
guide = guide.replace(
    """The mobile setup UI is split into:

```text
Shelly -> Termometry -> Reguła -> Diag
```

During Vite/dev builds the app exposes a hidden browser-console API under
""",
    """The top-level mobile shell is intent/dashboard-first. Installed users navigate
with `Klimat / Czas / Ustawienia`; hardware setup keeps the internal technical
steps:

```text
Shelly -> Termometry -> Reguła -> Diag
```

During Vite/dev builds the app exposes a hidden browser-console API under
"""
)
guide_path.write_text(guide)

# 4. Reclassify the old MVP document as history rather than current truth.
plan_path = Path('docs/plan.md')
plan = plan_path.read_text()
plan = plan.replace('# Local Climate Link — current MVP plan', '# Local Climate Link — historical MVP plan', 1)
plan = plan.replace(
    """Status: MVP `1.0.0` test candidate plan for this repository.

This file describes the current direction. Detailed contracts live in
`AGENTS.md`, vertical-slice history in `docs/implementation/vertical-slices.md`,
and architectural decisions in `docs/adr/`.
""",
    """Status: historical MVP `1.0.0` plan retained for design context.

The repository is now in the `2.0.x` product line. Current architecture lives in
`docs/architecture/overview.md` and the active product roadmap in
`docs/product/next-functional-steps.md`. Detailed contracts remain in
`AGENTS.md`, vertical-slice history in `docs/implementation/vertical-slices.md`,
and architectural decisions in `docs/adr/`.
""",
    1
)
plan_path.write_text(plan)

# 5. Add a current checkpoint to the canonical roadmap; keep earlier rationale as history.
roadmap_path = Path('docs/product/next-functional-steps.md')
roadmap = roadmap_path.read_text()
anchor = """This document is the canonical roadmap for the next product phase. It narrows the
older broad extension list to the work that should happen before commercial
packaging. `docs/plan.md` remains the MVP/history document.
"""
replacement = anchor + """

## Implementation checkpoint — 2026-09-10 / v2.0.10 line

The roadmap below records the rationale that led to the current architecture.
The following enabling/product slices are now implemented and should be treated
as the baseline rather than future work:

- persistent per-installation identity/configuration,
- intent-first entry and an installed-automation Dashboard,
- stable per-installation detail management,
- shared `Klimat / Czas / Ustawienia` bottom navigation and full-page Settings,
- explicit AUTO/MANUAL + relay controls with exact-script safety checks,
- native Shelly schedule ownership for pure time automation,
- progressive disclosure for advanced/service diagnostics,
- completed physical-button validation preserving native momentary behavior.

Near-term quality/product follow-ups should stay narrow: preserve truthful
runtime telemetry when controller state changes, decide whether history data
justifies a compact chart instead of fabricating/staling values, and continue
reducing hardware-setup composition debt along the documented responsibility
boundaries. Do not re-open the stable runtime safety model merely to simplify UI
code.
"""
assert anchor in roadmap, 'roadmap intro not found'
roadmap_path.write_text(roadmap.replace(anchor, replacement, 1))

# 6. Evergreen refactor-boundary document from the final quality audit.
refactor_path = Path('docs/architecture/refactor-boundaries.md')
assert not refactor_path.exists(), refactor_path
refactor_path.write_text("""# Refactor boundaries

This document captures responsibility hotspots found during the v2.0.10 final
quality audit. File size is a signal, not a refactor goal by itself.

## Current outcome

`ShellySetupPage.tsx` was the clearest UI composition hotspot. Pure formatting,
add-form rendering and the saved Shelly card were extracted into
`ShellySetupPresentation.tsx`, reducing the parent from roughly 1426 to about
1030 lines without moving Shelly/BLE mutations or changing behavior.

The remaining largest orchestration hotspot is
`flows/hardware-setup/useHardwareSetupFlow.ts` (about 1660 lines in the audit).
It coordinates roughly twenty hardware mutations across Shelly control, LAN
scan, temporary Shelly BLE discovery, phone BLE, PVVX GATT, installation and
diagnostics. Because several paths enforce OFF-first cleanup and exact runtime
ownership, a broad line-count-driven split is higher risk than leaving this seam
intact.

## Preferred future extractions

Extract one responsibility at a time, with the existing public
`HardwareSetupFlow` contract preserved until callers/tests are migrated:

1. saved Shelly status/control mutations and feedback acknowledgement,
2. Shelly BLE discovery session lifecycle and cleanup,
3. phone BLE live scan plus PVVX GATT coordination,
4. installation + safe relay test + diagnostic orchestration.

Each extraction must keep cleanup ordering, exact-script/relay ownership and
existing hardware regression tests intact. Do not combine these structural
changes with new product behavior.

## UI/design-system guardrails

Production mobile TSX uses Tabler icon components for standard action icons and
must not contain hand-authored `<svg>` or ad-hoc inline `style={{...}}` blocks.
Reusable dimensions/colors belong in generated `--lcl-*` tokens or shared
classes. `pnpm quality:ux` enforces these constraints, and `pnpm tokens:build`
must not modify generated outputs when the repository is clean.

## Audit hygiene

The audit also checks for `TODO/FIXME/HACK`, `@ts-ignore`, broad `eslint-disable`,
debug `console.log/debug`, and `as any` escape hatches in production paths.
Structural refactoring is only accepted when lint, typecheck, tests and the
repository/UX quality gates remain green.
""")

print('final docs + test hygiene applied')
