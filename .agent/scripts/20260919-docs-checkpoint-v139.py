from pathlib import Path

root = Path('.')

handoff = '''# Next chat handoff — post device-add UX checkpoint

Updated: 2026-09-19

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Start here

Before any write:

1. read `AGENTS.md`, this file, `docs/architecture/overview.md`, and `docs/architecture/refactor-boundaries.md`;
2. fetch the fresh work branch and `agent-control:.agent/status/daemon.json`;
3. verify that no duplicate Local Agent task is running;
4. use only the binding below.

```text
repository: MichalMatu/local-climate-link-starter
runtime catalog repo id: local-climate-link-starter
work branch: work/plug-screen-automation-entry-20260917
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Every `.agent/tasks/*.json` must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

## Verified product-code checkpoint

The app-code checkpoint closed in:

```text
2b0c045a16a1bc974191701fc73b05f054e65023
Polish discovery scan controls
```

Later commits in this checkpoint are documentation-only unless a fresh branch check proves otherwise. Always fetch before continuing.

The final app-code run passed:

- focused mobile typecheck and architecture/UX gates,
- focused Vitest suite: 87/87,
- one full `pnpm check`,
- clean push,
- clean Android reinstall and cold-start smoke on Samsung `SM-S906B`,
- `versionName=2.0.10`, `versionCode=20010`,
- `MainActivity` top-resumed with no matched app FATAL/ANR.

No phone reinstall is required for documentation-only commits.

## Product model that must remain stable

```text
physical Plug -> optional installed automation
```

Accepted invariants:

- bottom navigation is **Plugs | Thermometers | Settings**;
- `AppShell` owns the persistent bottom navigation;
- page content scrolls independently of that bottom navigation;
- automation setup starts from a concrete Plug;
- Time is a Plug automation type, not a global dashboard section;
- `InstalledAutomation` remains the durable installed-automation entity;
- a saved Plug remains useful without an automation;
- the phone configures, manages and diagnoses; the installed Shelly runtime executes independently;
- one relay has one managed automation owner at a time;
- delete/uninstall paths must preserve the existing safe OFF / identity verification behavior.

## Closed UX scope: add Plug / add Thermometer

Treat the two standalone device-add screens as **closed unless a real regression is found**.

Current contract:

- they are child pages, not working modals;
- no duplicate visible top back/title on standalone add pages;
- persistent bottom navigation remains visible;
- scan/manual choice is at the top;
- discovered devices use the shared `device-discovery-card` layout;
- name is editable before save;
- hardware identity/model are text, not fake input fields;
- compact `Add` action uses the same sizing/alignment for Plug and Thermometer;
- adding a device does not close the page;
- scan control sits below the result list;
- active scan control shows a small inline spinner and `aria-busy`;
- BLE phone discovery starts automatically because it has no pre-scan parameters;
- Shelly LAN discovery starts manually because the IP range is configurable and the scan actively probes the network;
- changing away from a scan task stops the owned scan; the BLE rerender lifecycle regression is covered by tests.

Do not reintroduce `STA/AP` presets, scan-help chrome, card-in-card page wrappers, or a separate progress row without a concrete requirement.

## Navigation / page-tree contract

Use this hierarchy:

```text
AppShell
  -> root tab page
     -> child page
        -> deeper child page when needed
           -> modal only for a transient decision / confirmation
```

Examples already implemented:

- Plug -> installation detail -> diagnostics / deployed script,
- Plugs -> add Plug,
- Thermometers -> add Thermometer.

A full working screen should not be placed in a modal just because the old implementation used one.

## Architecture checkpoint

There is no current architecture-gate failure and no single app-level god object that needs an emergency rewrite.

Healthy boundaries:

- `HardwareSetupScreen.tsx` is a coordinator/navigation composition layer;
- `useHardwareSetupFlow.ts` composes extracted subsystems rather than owning BLE/Shelly implementations directly;
- hardware pages consume narrow `ShellySetupFlow`, `SensorSetupFlow`, `RuleSetupFlow`, and `TimeScheduleSetupFlow` contracts;
- screens do not own raw `fetch` or Capacitor BLE transport;
- domain packages remain independent of React/Ionic;
- repository quality gates enforce these boundaries and line-budget alarms.

Watchlist, not immediate rewrite targets:

1. `apps/mobile/src/__tests__/hardware-setup.test.tsx` — very large scenario file. Split by real feature scenario when the area is next materially changed; do not rewrite tests just to reduce line count.
2. `apps/mobile/src/theme/theme.css` — large global stylesheet. Prefer extracting feature-cohesive styles when a screen is actively refactored; remove dead selectors opportunistically.
3. `ShellySetupPage.tsx` and `flows/hardware-setup/shellyRequests.ts` — responsibility-dense. If they grow, split by a concrete setup/transport responsibility, not arbitrary file size.
4. `useHardwareSetupFlow.ts` — still broad as a facade, but currently composes dedicated flows and is guarded by repository budgets. Keep its public surface from regrowing.

Do not raise architecture budgets to make a new change pass. Extract a cohesive responsibility instead.

## Next work in a new chat

The recommended next phase is **remaining-screen UX consistency**, one bounded surface at a time.

Start with a read-only visual/code audit of the remaining screens before choosing the next implementation slice. Look specifically for:

- working screens still implemented as modals,
- duplicate page navigation or headers,
- card-in-card layout inherited from old modal UX,
- inconsistent action sizing/spacing,
- technical data presented as editable controls when it is read-only,
- page content that scrolls the persistent shell/navigation,
- duplicated state or transport logic leaking into presentation.

Do not reopen the completed device-add screens unless the audit finds an actual regression.

When a next screen is selected, keep the normal workflow:

```text
fresh branch + daemon
-> preimplementation audit
-> smallest cohesive implementation
-> focused typecheck/gates/tests
-> exactly one final full pnpm check
-> commit/push
-> physical S22+ smoke for native/device/UI behavior that needs it
```

## Documentation map

Canonical/current:

- `AGENTS.md` — operating rules and Local Agent contract,
- `docs/HANDOFF_NEXT_CHAT.md` — continuation state,
- `docs/architecture/overview.md` — current product/runtime architecture,
- `docs/architecture/refactor-boundaries.md` — code responsibility boundaries and hotspot policy,
- `docs/product/next-functional-steps.md` — active roadmap.

Historical/reference only:

- `docs/plan.md` — historical MVP context,
- `docs/implementation/device-rule-decoupling-plan.md` — historical implementation plan for the now-implemented device/rule decoupling,
- `docs/prompts/` — historical prompts, not continuation state,
- older implementation notes and ADRs remain evidence/context unless explicitly superseded.

If current behavior and an old historical plan disagree, current code + canonical docs above win.
'''

overview = '''# Architecture overview

Updated: 2026-09-19

## Product boundary

Local Climate Link is a local configurator and management UI for Shelly Plugs, BLE thermometers and Plug-owned automations.

The primary mental model is:

```text
physical Plug -> optional installed automation
```

A Plug is useful without an automation: it can expose telemetry, direct relay control and management. Climate and time automations attach to a concrete Plug.

## Runtime ownership

```text
Phone app
  - discovers and saves devices
  - edits configuration
  - installs / removes managed automation
  - shows status, diagnostics and management UI

Shelly
  - owns the installed runtime
  - reads the configured BLE sensor for climate automation
  - applies the relay decision locally
  - continues operating without the phone
```

The phone must not become a required runtime hub for an installed climate or time automation.

## Navigation architecture

`AppShell` is the application frame and the single owner of the persistent bottom navigation:

```text
Plugs | Thermometers | Settings
```

The shell itself does not scroll with page content. Root pages and child pages render inside the shell's scrollable content area.

Use the page tree for substantial work:

```text
AppShell
  -> root page
     -> child page
        -> deeper child page
           -> modal only for a transient decision / confirmation
```

Examples:

- Plugs -> add Plug,
- Thermometers -> add Thermometer,
- Plug -> installation detail -> diagnostics / deployed script.

A modal is appropriate for delete/safety confirmation or another short decision. It is not the default container for a complete working screen.

## Device discovery semantics

Phone BLE discovery and Shelly LAN discovery intentionally do not start the same way:

- **BLE Thermometer:** auto-start when entering the BLE scan task. There are no pre-scan parameters and discovery is passive from the user's point of view.
- **Shelly Plug:** manual start. The user can edit `From / To`, and the scan actively probes the selected IP range.

Both screens share the same result-card contract:

```text
editable display name + compact Add action
primary hardware identity + secondary model/profile
optional live metrics
```

Adding a discovered device does not leave the page. Scan ownership is cleaned up when leaving/switching the task.

## Data ownership

Keep these concepts separate:

- physical Shelly Plug identity and metadata,
- physical BLE thermometer identity/profile,
- transient sensor readings,
- setup draft state,
- durable `InstalledAutomation`,
- installed Shelly script/runtime diagnostics.

Display names are user-facing state and are separate from hardware identity such as model, generation, IP or MAC.

## Code layers

### Domain packages

`packages/*` contains reusable domain/runtime logic. Domain packages must not depend on React/Ionic. Transport-specific Capacitor BLE imports are limited to BLE adapter boundaries.

Important packages include:

- `@lcl/automation-core` — rule/domain logic,
- `@lcl/ble-core` — BLE parsing and adapters,
- `@lcl/shelly-client` — Shelly RPC/install primitives,
- `@lcl/script-generator` — managed runtime generation/decoding,
- `@lcl/diagnostics` — bounded/redacted diagnostics,
- `@lcl/ui` — shared presentation primitives.

### Mobile flows

`apps/mobile/src/flows/*` owns app orchestration and transport use. Hardware setup is composed from focused flows including:

- Shelly control/status,
- Shelly LAN scan,
- Shelly-side BLE discovery,
- phone BLE discovery/live readings,
- climate automation installation.

`useHardwareSetupFlow` is a facade/composition hook. Do not move subsystem implementations back into it.

### Screens

Screens compose flows into product UI. They must not call raw `fetch` or import the Capacitor BLE plugin directly. Hardware setup pages receive narrow page contracts rather than the full setup flow.

`HardwareSetupScreen` coordinates setup navigation and lifecycle cleanup; it should not absorb page-specific presentation or transport logic.

## Automation ownership and safety

- one Plug relay has one managed automation owner at a time;
- plain saved Plugs are allowed;
- Time is a Plug automation type rather than a global section;
- `InstalledAutomation` remains the durable installed-automation record;
- uninstall/delete must verify managed identity, preserve conflict handling, force the relay to a safe OFF state where required, remove the managed runtime and verify the result;
- visual refactors must not weaken runtime ownership or safe-delete behavior.

## Architecture enforcement

`scripts/quality/repository-gate.mjs` enforces key boundaries, including:

- no raw network/BLE transport in screens,
- no React/Ionic imports in domain packages,
- a size alarm for `useHardwareSetupFlow`,
- size alarms for extracted hardware subsystems/pages,
- narrow page-flow contracts.

These budgets are regression alarms. Do not raise them to accommodate responsibility creep; extract a cohesive subsystem instead.

Current hotspot policy is documented in `docs/architecture/refactor-boundaries.md`.
'''

boundaries = '''# Refactor boundaries

Updated: 2026-09-19

File size is an alarm, not a refactor goal. Split code only at a real responsibility boundary, to remove duplicate state/transport ownership, or when a quality budget proves that a boundary is regrowing.

## Enforced direction

```text
packages/domain + adapters
        ^
        |
mobile flows / stores
        ^
        |
screens / route composition
        ^
        |
shared UI primitives
```

More concretely:

- domain packages do not import React/Ionic;
- screens do not call raw `fetch`;
- screens do not import the Capacitor BLE plugin;
- transport/runtime implementation belongs in clients/adapters/flows;
- pages consume narrow flow contracts;
- UI primitives do not make product/runtime ownership decisions.

`scripts/quality/repository-gate.mjs` is the executable boundary contract. Keep it green; do not increase budgets just to land a change.

## Hardware setup boundary

`HardwareSetupScreen.tsx` is a coordinator. Its responsibilities are limited to:

- selecting the current setup page/tab,
- applying route/setup context,
- opening/closing local child pages where needed,
- lifecycle cleanup when the whole setup surface leaves.

It must not own Shelly RPC details, BLE parsing/scanning implementation or page-specific presentation.

`useHardwareSetupFlow.ts` is a facade over cohesive subsystems. Current extracted responsibilities include:

- `useShellyControlFlow`,
- `useShellySetupScanFlow`,
- `useShellyBleDiscoveryFlow`,
- `usePhoneSensorFlow`,
- `useClimateAutomationInstallFlow`.

Do not move those implementations back into the facade.

Hardware pages use narrow contracts such as `ShellySetupFlow`, `SensorSetupFlow`, `RuleSetupFlow` and `TimeScheduleSetupFlow`. A page must not recover the complete `HardwareSetupFlow` indirectly.

## Navigation/presentation boundary

`AppShell` owns persistent bottom navigation. Child pages own their own working content. A full working task should be a page/subpage; modal scope is limited to transient decisions or confirmations.

The completed Plug/Thermometer add pages establish the discovery-card presentation contract. Reuse its principles before inventing another one-off layout, but do not prematurely generalize unrelated screens into one component.

## Current architecture checkpoint

At product-code checkpoint `2b0c045a16a1bc974191701fc73b05f054e65023`:

- repository architecture/UX gates pass;
- `HardwareSetupScreen` is a coordinator rather than the previous all-purpose setup screen;
- `useHardwareSetupFlow` composes dedicated flows and remains protected by a 650-line alarm plus a bounded public surface;
- Shelly/Sensor/Rule pages have explicit composition budgets;
- phone BLE and Shelly discovery lifecycle ownership remains outside route/shell code.

There is no current reason for a broad architecture rewrite before continuing screen-by-screen UX work.

## Watchlist

### `apps/mobile/src/__tests__/hardware-setup.test.tsx`

This is the clearest god-file risk. It is intentionally scenario-heavy and provides valuable end-to-end regression coverage, but it has accumulated many unrelated hardware-setup scenarios.

When this area is next materially expanded, prefer moving cohesive scenario groups into separate test files while preserving behavior and shared helpers. Do not rewrite it solely to make it shorter.

### `apps/mobile/src/theme/theme.css`

This is a large global stylesheet and can hide stale selectors or cross-screen overrides. The recent discovery-card width mismatch was an example of old selectors affecting a new contract.

When a screen is actively refactored:

- remove dead selectors in the touched area,
- prefer a feature-cohesive style boundary when there is a natural one,
- keep design tokens shared,
- avoid a repository-wide CSS rewrite as an unrelated side quest.

### `ShellySetupPage.tsx`

The page is bounded to Shelly setup, but it still coordinates saved-device management, add/manual/scan presentation and several transient management dialogs. If new responsibilities are added, extract by concrete task (for example scan result presentation or management surface), not by arbitrary line slices.

### `flows/hardware-setup/shellyRequests.ts`

This service is a dense Shelly RPC boundary. Keep RPC details here/out of screens, but split into cohesive request families if new unrelated RPC responsibilities make it harder to reason about or test.

### `useHardwareSetupFlow.ts`

Broad by design as a facade. Keep it composition-focused. New transport loops, timers, parsers or runtime ownership should become focused flows/services rather than new inline sections.

## When to refactor

Refactor now when at least one is true:

- two places own the same state or lifecycle,
- transport logic leaks into presentation,
- a screen/page needs the full flow only to reach one subsystem,
- a quality budget is exceeded,
- a change requires touching several unrelated branches of one file,
- stale CSS/test coupling causes repeated regressions.

Otherwise prefer the smallest product change and leave stable code alone.
'''

roadmap = '''# Local Climate Link — next functional steps

Updated: 2026-09-19

## Current checkpoint

Product-code baseline:

```text
2b0c045a16a1bc974191701fc73b05f054e65023
Polish discovery scan controls
```

The Plug/Thermometer standalone add-page refactor is closed. It passed focused checks, one full `pnpm check`, push and physical Samsung S22+ install/cold-start smoke.

Do not spend the next iteration reopening those two screens unless a concrete regression is observed.

## Stable product model

- bottom navigation: **Plugs | Thermometers | Settings**;
- a physical Plug is the automation anchor;
- `+` on Plugs adds a Plug;
- `+` on Thermometers adds a Thermometer;
- a plain Plug remains manageable/useful without automation;
- Time is a Plug automation type;
- climate automation runs locally on Shelly after installation;
- `InstalledAutomation` is the durable automation entity;
- user display names remain separate from hardware identity.

## Next phase: remaining-screen UX consistency

Before implementing anything, inspect the remaining screens on current code and on the S22+ where useful. Select **one** bounded surface per pass.

Prioritize concrete inconsistencies such as:

- substantial working content still trapped in a modal,
- duplicate navigation/header chrome,
- page containers that still look like stretched modal cards,
- nested/card-in-card surfaces without semantic value,
- inconsistent action placement or sizing,
- read-only technical data styled as editable fields,
- scroll behavior that competes with the persistent app shell,
- presentation code that owns network/BLE/runtime lifecycle.

Keep modal usage for decisions/confirmations. Preserve the `AppShell -> page -> child page -> decision modal` hierarchy.

## Completed device-add contract

Keep these decisions unless evidence requires change:

- discovery result cards share one visual grammar;
- display name is editable before save;
- identity/model are read-only text;
- `Add` remains compact and aligned with the name field;
- saving does not leave the add page;
- scan control remains below the results;
- active scan state is shown by an inline spinner inside the scan control;
- BLE scan auto-starts;
- Shelly LAN scan requires explicit start after range review.

## Architecture work: only when the next feature touches it

Do not start a broad cleanup project now. The current architecture gates pass.

Use the watchlist in `docs/architecture/refactor-boundaries.md` when the next screen requires related changes. In particular:

- split `hardware-setup.test.tsx` by cohesive scenario only when materially extending it;
- extract feature-cohesive CSS when touching a screen with stale/global selector pressure;
- keep `ShellySetupPage` and `shellyRequests.ts` from absorbing unrelated responsibilities;
- keep `useHardwareSetupFlow` as a facade over focused flows.

## Verification discipline

For each implementation slice:

1. fetch fresh branch + Local Agent daemon;
2. do a preimplementation audit first;
3. implement the smallest cohesive change;
4. run focused typecheck/quality/tests;
5. run exactly one final full `pnpm check` on the successful iteration;
6. commit/push only green state;
7. perform physical S22+ smoke when the change affects native/device behavior or a UI interaction that needs visual/device verification.

Hardware-mutating tests remain explicit and bounded. Preserve the existing safe relay/uninstall contracts.

## Later product work

After the remaining core screens are visually coherent, resume functional expansion from an explicit product requirement rather than speculative infrastructure. Likely categories include richer Plug management, additional device profiles and additional automation types, but none should bypass the Plug-owned automation model or create a second runtime owner.
'''

(root / 'docs/HANDOFF_NEXT_CHAT.md').write_text(handoff, encoding='utf-8')
(root / 'docs/architecture/overview.md').write_text(overview, encoding='utf-8')
(root / 'docs/architecture/refactor-boundaries.md').write_text(boundaries, encoding='utf-8')
(root / 'docs/product/next-functional-steps.md').write_text(roadmap, encoding='utf-8')

backlog = root / 'docs/ux-polish-backlog.md'
if backlog.exists():
    backlog.unlink()

historical_path = root / 'docs/implementation/device-rule-decoupling-plan.md'
historical = historical_path.read_text(encoding='utf-8')
old = '''# Device and rule decoupling implementation plan\n\nStatus: implementation-ready plan  \nAudited product baseline: `47116b57faba21e03276ba7185ea04c4ec50da4b` (`main`, v2.0.10 integration baseline)  \nTarget implementation branch: `work/device-rule-decoupling-20260913`\n'''
new = '''# Device and rule decoupling implementation plan\n\n> Historical implementation record. The device/rule decoupling described here is implemented in the current 2.0.x product architecture. Do not use this file as the active continuation plan; use `docs/HANDOFF_NEXT_CHAT.md`, `docs/architecture/overview.md`, and `docs/product/next-functional-steps.md`.\n\nOriginal audited baseline: `47116b57faba21e03276ba7185ea04c4ec50da4b` (`main`, v2.0.10 integration baseline)  \nOriginal implementation branch: `work/device-rule-decoupling-20260913`\n'''
if old not in historical:
    raise SystemExit('Historical plan header did not match expected content')
historical_path.write_text(historical.replace(old, new, 1), encoding='utf-8')

print('Refreshed canonical docs, removed stale UX backlog, marked decoupling plan historical')
