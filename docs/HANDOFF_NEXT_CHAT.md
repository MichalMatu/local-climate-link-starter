# Next chat handoff — post device-add UX checkpoint

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
