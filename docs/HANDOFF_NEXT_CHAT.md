# Local Climate Link — next chat handoff

Updated: 2026-09-11

This is the canonical continuation handoff. Read it before changing code.

## Hard repository binding and execution model

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`

Every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

ChatGPT plans; Local Agent executes deterministic commands/scripts. Never launch local Codex from a Local Agent task. Before editing a work branch, read `.agent/status/daemon.json` and proceed only when the repository/binding match and the worker is idle.

## Current product baseline

Latest behavior-changing implementation checkpoint pending final merge:

```text
2f42db968fa241c0d904d549befeaad249f48e18
refactor(mobile): centralize setup feedback state
```

Frozen MANUAL-runtime rollback tag remains:

```text
stable-20260911-manual-runtime
4462a5246e06f7cebcb5808eace2d6278988e56e
```

Remote branch cleanup state at this checkpoint: `work/production-readiness-hardening-20260911` is the only product work branch expected before final fast-forward into `main`; it must be removed after the merge.

## Completed and accepted product state

The current v2.0.10 line now includes:

- persistent per-installation identity/configuration,
- dashboard-first entry with Add automation opened only from `+`, stable installation detail and shared bottom navigation,
- climate AUTO/MANUAL runtime mode where the managed Shelly script stays running in both modes,
- MANUAL-only direct relay ON/OFF using the verified existing safety path,
- native Shelly schedules for pure time automation,
- current-value climate UI without sensor chart/history persistence,
- installation-scoped diagnostics with runtime/resource, BLE health and Shelly electrical/system telemetry,
- diagnostics auto-refresh every 3 seconds only while the modal is open; background polling is disabled and manual refresh remains available,
- responsive bottom-navigation/toast spacing verified by Playwright,
- native Shelly physical-button behavior preserved as `momentary` with no detached/long-press ownership added by Local Climate Link.

The exact `16d8627b...` Android build was installed on the Samsung S22+ and opened successfully. The user physically reviewed the new installation-detail controls and diagnostics UX and accepted this tranche.

## Runtime invariants that must not regress

### AUTO

- exact managed climate script remains running,
- BLE runtime and `/script/<id>/diag` remain live,
- automatic relay decisions are allowed.

### MANUAL

- exact managed climate script still remains running,
- BLE/runtime diagnostics remain live,
- automatic output decisions are blocked inside the generated runtime,
- direct phone ON/OFF is allowed only after verified MANUAL ownership/capability.

### STOPPED / MISSING

These are maintenance/failure states, not aliases for MANUAL. Normal AUTO/MANUAL switching must not use `Script.Stop`/`Script.Start`.

## Navigation UX consistency tranche (2026-09-11)

Completed and validated in `8012d21e57d27f07b070f3e64b3432eb7b4abe2e`:

- zero-installation state now stays on the normal `Twoje automatyki` dashboard instead of auto-opening setup,
- the Add automation intent picker opens only from the dashboard `+` action,
- removing the final automation returns to the empty dashboard rather than reopening setup,
- the legacy global top-right Settings trigger was removed; app Settings are entered through the shared bottom navigation,
- Add automation and hardware setup retain the global `Klimat / Czas / Ustawienia` navigation while preserving their local setup tabs,
- the Add automation picker no longer exposes the obsolete `Zarządzaj istniejącą automatyką` choice,
- the source dashboard tab is preserved when opening/cancelling Add automation,
- time-installation detail now follows the same global bottom-navigation pattern as climate detail and no longer uses the legacy text `Wróć do automatyki` action,
- the installation-not-found state also exposes the shared bottom navigation,
- Android Back is consistent: setup → intent → dashboard → app exit,
- page-title sizing for the intent picker now follows the normal app-page hierarchy instead of the oversized hero heading,
- device-specific Shelly settings controls remain unchanged and are intentionally distinct from app-level Settings.

Validation for this tranche is green: mobile unit/integration suite, typecheck, lint, `quality:ux`, `quality:repo`, build and the full responsive Playwright matrix (**25/25**) all passed. No Shelly runtime, generated automation script, BLE ownership or LED behavior was changed by this UX tranche.

The production-readiness tranche is behavior-preserving for Shelly runtime/safety paths. After final merge, install the exact final `main` build as a release sanity check; no new physical Shelly behavior test is required unless runtime behavior changes.

## Production-readiness hardening tranche (2026-09-11)

Completed and validated through `2f42db968fa241c0d904d549befeaad249f48e18`:

- removed the dead `DemoWizard`/demo flow, obsolete `manage` setup intent and stale locale copy,
- kept visual tokenization centralized and strengthened UX gates so new mobile CSS cannot silently bypass the token system,
- reduced `useHardwareSetupFlow` from roughly 1656 to 1021 lines by extracting cohesive Shelly control, Shelly-side BLE discovery and phone/sensor BLE subsystems,
- reduced the hardware-setup public surface from roughly 119 to 108 fields and introduced typed per-page `Pick` contracts,
- added repository ratchets that cap orchestrator/public-API growth and prevent pages from depending on the full setup flow,
- replaced independent modal booleans on the largest setup pages with cohesive discriminated dialog state; local `useState` occurrences fell from about 16/8/7 to 4/3/3 for Shelly/Rule/Sensor,
- centralized setup toast queue behavior, including diagnostics,
- kept `packages/script-generator`, `packages/automation-core`, `packages/shelly-client` and installation runtime paths unchanged.

Validation is green: formatting, lint, `quality:ux`, `quality:repo`, typecheck, all workspace tests, core coverage, build and responsive Playwright (**25/25**). Final read-only diff audit also passed with no TODO/FIXME/HACK, eslint disables, TypeScript suppressions, production `any`, or inline JSX styles.

Large setup-page files may still contain substantial declarative JSX; do not split them merely to reduce line counts. Future extraction should follow a concrete responsibility boundary or measurable coupling problem.

## Next agreed vertical slice — Shelly LED configuration

This is the next product task unless the user explicitly changes priority.

### Current implementation

`apps/mobile/src/screens/ShellyLedSettingsCard.tsx` already reads `PLUGS_UI` and shows the current LED mode. For `switch` mode it displays relay ON/OFF RGB + brightness; for `power` mode it displays brightness.

`apps/mobile/src/flows/installations/deviceLed.ts` currently exposes only two write presets:

- `relay-state`
- `off`

`packages/shelly-client/src/plugsUi.ts` already validates and writes more than the wrapper exposes:

- modes `power`, `switch`, `off`,
- arbitrary `switch:0` ON RGB + brightness,
- arbitrary `switch:0` OFF RGB + brightness,
- power-mode brightness.

Therefore the next slice should expand the app/device wrapper and UX; it should not create a second RPC client or add LED logic to the generated climate script.

### Target scope

1. Preimplementation audit the existing LED card, `deviceLed.ts`, `plugsUi.ts`, tests and the current Shelly Plug S Gen3 behavior before editing.
2. Add editable LED configuration using the existing `PLUGS_UI.SetConfig` path:
   - LED mode: `switch`, `power`, `off`,
   - relay ON color and brightness in switch mode,
   - relay OFF color and brightness in switch mode,
   - power-mode brightness when that mode is selected.
3. Keep quick presets only if they improve UX; do not let presets become a parallel state model.
4. After every write, re-read the exact Shelly configuration and display the confirmed device state.
5. Keep unsupported/older firmware graceful: read-only unsupported state, no fake defaults and no broken installation detail.
6. Keep the UI compact and consistent with the current installation-detail pattern; avoid another large god component or a second settings system.
7. Add focused Shelly-client validation tests, installation-flow tests, UI tests and responsive E2E coverage.
8. Finish with a real Shelly Plug S Gen3 smoke test and restore a deliberate final LED state.

### Explicit non-goals for the first LED expansion

- no thermostat-script LED ownership,
- no dynamic error flashing based on RSSI/battery/runtime reasons,
- no coupling between LED state and proof that automation is healthy,
- no physical-button behavior changes,
- no speculative night-mode UI unless a separate capability/schema audit explicitly brings it into scope.

## Canonical planning documents

Use these roles consistently:

- `docs/HANDOFF_NEXT_CHAT.md` — current continuation state and the next concrete task,
- `docs/product/next-functional-steps.md` — canonical active product roadmap,
- `docs/plan.md` — historical MVP/design context only,
- `docs/architecture/` and `docs/adr/` — current architecture and decisions,
- `docs/implementation/` — durable implementation contracts/history, not a task backlog.

Do not create another TODO/continue file for LED work; update the two canonical files above instead.

## Validation expectations for the next code slice

At minimum:

```sh
pnpm --filter @lcl/shelly-client test
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile lint
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build
pnpm e2e:responsive
```

Also run `git diff --check`, inspect the final diff before merge, and keep the generated climate script untouched unless the task explicitly changes runtime behavior.

## Change philosophy

- evidence-driven,
- small, clean, low-risk/high-gain changes,
- no god objects,
- no duplicate state/RPC paths,
- preserve the stable runtime safety model,
- prefer device-native Shelly features for device UI such as LED configuration,
- keep user-facing UI calm and service diagnostics progressively disclosed.
