# Next chat handoff — post remaining-screen UX consistency audit

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

Current app-code checkpoint:

```text
965618b0023946a16acee6dc46a33eea9be7df50
Stabilize BLE child-page cleanup callback
```

The remaining-screen UX consistency pass is closed at this checkpoint.

Key commits in the completed pass:

```text
d8606f8c  Unify missing installation page chrome
55e80fce  Move Plug settings into page tree
45919dd2  Move Plug BLE discovery into page tree
a9efc38b  Unify setup flow back chrome
2465521e  Move configurator Shelly tools into page tree
2a164a34  Remove dead advanced settings modal
965618b0  Stabilize BLE child-page cleanup callback
```

Final validation on `965618b0` passed:

- mobile ESLint for the touched page with `--max-warnings=0`;
- mobile typecheck;
- UX and repository quality gates;
- focused Vitest suite: 58/58;
- one full `pnpm check` with no lint warnings;
- clean commit and push.

Android alpha build also completed successfully during the preceding `2465521e` validation. Installation/cold-start smoke did not run because ADB reported exactly zero authorized devices. Treat physical Samsung S22+ smoke as **outstanding validation only**, not as a code failure. The app version remains `versionName=2.0.10`, `versionCode=20010` unless a fresh branch check proves otherwise.

## Product model that must remain stable

```text
physical Plug -> optional installed automation
```

Accepted invariants:

- bottom navigation is **Plugs | Thermometers | Settings**;
- `AppShell` owns persistent bottom navigation;
- page content scrolls independently of that navigation;
- automation setup starts from a concrete Plug;
- Time is a Plug automation type, not a global dashboard section;
- `InstalledAutomation` remains the durable installed-automation entity;
- a saved Plug remains useful without an automation;
- the phone configures, manages and diagnoses; the installed Shelly runtime executes independently;
- one relay has one managed automation owner at a time;
- delete/uninstall paths preserve safe OFF / identity verification behavior.

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
- changing away from a scan task stops the owned scan.

Do not reopen these screens without a concrete regression.

## Closed UX scope: remaining-screen consistency audit

The broad remaining-screen audit is also **closed**. Do not restart it from scratch in the next chat.

Completed navigation/page-tree work:

- missing Installation detail/diagnostics/script states use shared `AppPageBack` chrome;
- saved Plug settings are a child page from the Plug dashboard;
- saved Plug BLE discovery is a deeper child page from Plug settings;
- configurator saved-Shelly settings are a child page instead of a working modal;
- configurator Shelly BLE discovery is a deeper child page and preserves BLE cleanup when Back is pressed during scanner startup;
- setup-flow back chrome uses shared `AppPageBack`;
- the dead `RuleAdvancedSettingsModal.tsx` was removed; active advanced settings remain inline.

Audit conclusions that should remain stable unless a concrete regression appears:

- full working tasks belong in the page tree;
- remaining confirmation/error/picker/preview modals are transient and are acceptable as modals;
- `TimeInstallationDetail` has intentional status/mode/refresh header content and was not changed merely because it uses older header classes;
- diagnostics technical fields remain intentional diagnostics, not editable settings;
- rule script preview is a transient read-only preview/copy surface and remains a modal;
- `ShellySettingsModal` and `ShellyBleDiscoveryModal` are still referenced fallback components inside `ShellySetupPage`; do not delete them merely because normal dashboard/configurator navigation now routes the working surfaces as pages.

## Navigation / page-tree contract

Use this hierarchy:

```text
AppShell
  -> root tab page
     -> child page
        -> deeper child page when needed
           -> modal only for a transient decision / confirmation
```

A full working screen should not be placed in a modal just because an older implementation used one.

## Architecture checkpoint

There is no current architecture-gate failure and no app-level god object requiring a broad rewrite.

Healthy boundaries:

- `HardwareSetupScreen.tsx` is a coordinator/navigation composition layer;
- `useHardwareSetupFlow.ts` composes extracted subsystems rather than owning BLE/Shelly implementations directly;
- hardware pages consume narrow `ShellySetupFlow`, `SensorSetupFlow`, `RuleSetupFlow`, and `TimeScheduleSetupFlow` contracts;
- screens do not own raw `fetch` or Capacitor BLE transport;
- domain packages remain independent of React/Ionic;
- repository quality gates enforce these boundaries and line-budget alarms;
- `RuleAdvancedSettingsInline.tsx` now carries the 220-line responsibility budget formerly attached to the deleted modal.

Watchlist, not immediate rewrite targets:

1. `apps/mobile/src/__tests__/hardware-setup.test.tsx` — large scenario file. Split only when materially extending a cohesive feature area. Existing React `act(...)` warnings in the frozen standalone-add regression test are test-harness noise, not a reason to reopen the add screens by themselves.
2. `apps/mobile/src/theme/theme.css` — large global stylesheet. Remove stale selectors opportunistically only when touching the related surface.
3. `ShellySetupPage.tsx` and `flows/hardware-setup/shellyRequests.ts` — responsibility-dense. Split only at concrete setup/transport boundaries if they grow.
4. `useHardwareSetupFlow.ts` — broad facade by design. Keep new transport loops/timers/parsers in focused flows/services.

Do not raise architecture budgets just to make a change pass.

## Next work

Do **not** start another broad UX consistency sweep. The next implementation should come from an explicit product requirement or a concrete regression.

Reasonable future product categories remain:

- richer Plug management/configuration;
- additional supported sensor/device profiles;
- additional Plug-owned automation types;
- targeted polish on a specific screen when a real usability issue is observed.

Preserve the Plug-owned automation model and single runtime owner.

If the Samsung S22+ becomes visible again, it is useful to complete the outstanding physical install/cold-start smoke for the current checkpoint before a native/device-sensitive change, but do not treat device absence as blocking unrelated web/TypeScript work.

## Normal workflow for the next implementation slice

```text
fresh branch + daemon
-> bounded preimplementation audit
-> smallest cohesive implementation
-> focused typecheck/gates/tests
-> exactly one final full pnpm check
-> commit/push
-> physical S22+ smoke when native/device/UI behavior needs it
```

## Documentation map

Canonical/current:

- `AGENTS.md` — operating rules and Local Agent contract;
- `docs/HANDOFF_NEXT_CHAT.md` — continuation state;
- `docs/architecture/overview.md` — current product/runtime architecture;
- `docs/architecture/refactor-boundaries.md` — responsibility boundaries and hotspot policy;
- `docs/product/next-functional-steps.md` — active roadmap.

Historical/reference only:

- `docs/plan.md` — historical MVP context;
- `docs/implementation/device-rule-decoupling-plan.md` — historical implementation plan;
- `docs/prompts/` — historical prompts;
- older implementation notes and ADRs remain evidence/context unless explicitly superseded.

If current behavior and an old historical plan disagree, current code + canonical docs above win.
