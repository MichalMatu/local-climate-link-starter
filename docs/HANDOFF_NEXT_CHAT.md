# Next chat handoff — post UI polish and toast-host hardening

Updated: 2026-09-20

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

## Current verified app-code checkpoint

Latest app-code checkpoint:

```text
8ad5b152bdbf861a8e6620414245dfbcb06c0ead
Anchor app toasts above bottom navigation
```

Documentation commits follow this app-code checkpoint on the same work branch. Always fetch the fresh branch instead of resetting to the app-code SHA.

Recent product/UI commits in this completed slice:

```text
97bef795  Auto-correct invalid rule threshold gaps
cd75397e  Polish Plug naming and sensor metadata
49e641f7  Polish glass surfaces and modal geometry
8ad5b152  Anchor app toasts above bottom navigation
```

### Final validation for toast-host hardening

On `8ad5b152`:

- mobile typecheck passed;
- `quality:ux` passed;
- `quality:repo` passed;
- targeted Playwright toast geometry test passed;
- one full `pnpm check` passed;
- commit/push passed;
- screenshot run generated five real viewport captures and re-ran the toast geometry scenario successfully.

Canonical viewport coverage for the toast/nav regression:

```text
360×800
390×844
412×915
768×1024
1440×900
```

The geometry test requires the toast to be mounted in `#app-toast-host`, outside `.app-root-shell__content`, fully inside the viewport and immediately above the persistent bottom navigation.

## Toast regression root cause and permanent contract

The preceding glass polish added `backdrop-filter` to shared page surfaces such as `.demo-panel`. Several screens still mounted the shared `ToastViewport` inside those surfaces. A filtered/transformed ancestor can establish a containing block for fixed descendants, so `position: fixed` toast geometry became relative to different page surfaces instead of the application viewport. That is why toasts appeared in inconsistent vertical positions.

The permanent architecture is now:

```text
AppShell
  -> scrollable page content
  -> app-toast-host
  -> persistent bottom navigation
```

Rules:

- `@lcl/ui` still owns the shared visual `ToastViewport` primitive and toast tokens;
- mobile screens use `AppToastViewport`, which portals into the shell-owned `#app-toast-host`;
- screen/flow code may own its toast message queue, but not toast viewport geometry;
- do not add per-screen `bottom` offsets;
- do not render raw `<ToastViewport>` in `apps/mobile/src/screens/**`;
- `scripts/quality/ux-gate.mjs` enforces the host/portal contract and blocks raw screen-level toast viewports;
- `AppBottomNavigation.css` owns the tokenized bottom-nav/safe-area offset.

This contract is documented in `docs/architecture/overview.md`.

## Completed UI polish in the same slice

### Plug naming / detail consistency

- redundant top `‹ Plugs` navigation was removed from the real Plug detail screen because persistent bottom navigation already owns root-tab navigation;
- Plug display name can be edited from the main Plug card and from Plug detail;
- configured/installed Plug cards use the same editable-name behavior;
- naming stays synchronized with the saved physical Plug / installation presentation contract;
- regression coverage protects these entry points.

### Thermometer card metadata

The old expandable `Details` block was removed when it only hid two metadata values.

Current card contract:

```text
existing single separator
model/profile on the left
MAC / hardware id on the right
```

No extra separator and no `Type` / `MAC` labels. Metadata typography is intentionally quieter than live measurement data.

### Rule page polish

- invalid paired thresholds auto-repair by one whole unit only when the pair is invalid;
- valid narrower hysteresis remains untouched;
- `Shelly Script preview` was shortened to `Shelly Script`;
- Rule/VPD info-label alignment was normalized;
- relay-test / shared modals use common content-driven geometry with a shared max height rather than per-modal size variants.

### Glass surfaces

A restrained glass treatment was added to major shared surfaces. Do not solve future glass-related layout issues by adding page-specific positioning exceptions. Keep geometry-critical overlays (toast host, modal layer, persistent nav) outside filtered page surfaces when appropriate.

## Device and visual validation state

A physical Samsung S22+ install/cold-start smoke succeeded for the preceding `49e641f7` polish build (`versionName=2.0.10`, `versionCode=20010`). The user disconnected the phone after the toast-host change and explicitly authorized autonomous emulator/screenshot validation instead.

The current toast-host implementation was validated with real Playwright screenshots at all five canonical viewports: 360×800, 390×844, 412×915, 768×1024 and 1440×900. A compact contact-sheet review confirmed the same visual contract in every capture: the toast sits immediately above the persistent bottom navigation, remains fully inside the viewport, does not overlap or get clipped by the nav, fills the available mobile width with normal margins, and uses the existing right-aligned max-width presentation on larger tablet/desktop viewports.

The local Android `medium_phone` AVD is configured as Android 36 / `arm64-v8a`; emulator 37.1.11 sees Hypervisor.Framework and the system image correctly. However, autonomous headless cold-boot attempts did not make the AVD visible to ADB. The latest bounded attempt waited 120 × 5 seconds (about ten minutes) and ended in `BOOT_TIMEOUT` with the emulator process still alive. No current app build was installed to that emulator, so native emulator smoke for `8ad5b152` remains unverified. Treat this as local emulator infrastructure evidence, not an app-code failure, and do not claim native emulator validation until the AVD actually reaches ADB `device` state.

Physical-device absence is not a blocker for unrelated TypeScript/web/UI work. For layout-only regressions, responsive Playwright remains valid evidence. For native-only behavior, use a working Android emulator or a physical device and state explicitly which one provided the evidence.

## Product model that must remain stable

```text
physical Plug -> optional installed automation
```

Accepted invariants:

- bottom navigation is **Plugs | Thermometers | Settings**;
- `AppShell` owns persistent bottom navigation and the global toast host;
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

The broad remaining-screen audit is also **closed**. Do not restart it from scratch.

Stable conclusions:

- full working tasks belong in the page tree;
- confirmation/error/picker/preview modals remain transient and acceptable as modals;
- `TimeInstallationDetail` has intentional status/mode/refresh header content;
- diagnostics technical fields remain diagnostics, not editable settings;
- rule script preview remains a transient read-only preview/copy surface;
- `ShellySettingsModal` and `ShellyBleDiscoveryModal` remain referenced fallback components and must not be deleted merely because normal routes prefer pages.

## Navigation / page-tree contract

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
- `@lcl/ui` owns reusable presentation primitives; `AppShell` owns app-frame geometry such as persistent nav and the toast host;
- repository/UX quality gates enforce these boundaries and regression contracts;
- `RuleAdvancedSettingsInline.tsx` carries the 220-line responsibility budget formerly attached to the deleted modal.

Watchlist, not immediate rewrite targets:

1. `apps/mobile/src/__tests__/hardware-setup.test.tsx` — large scenario file. Split only when materially extending a cohesive feature area. Existing React `act(...)` warnings in the frozen standalone-add regression test are test-harness noise.
2. `apps/mobile/src/theme/theme.css` — large global stylesheet. Remove stale selectors opportunistically only when touching the related surface.
3. `ShellySetupPage.tsx` and `flows/hardware-setup/shellyRequests.ts` — responsibility-dense. Split only at concrete setup/transport boundaries if they grow.
4. `useHardwareSetupFlow.ts` — broad facade by design. Keep new transport loops/timers/parsers in focused flows/services.

Do not raise architecture budgets or weaken UX gates merely to make a change pass.

## Repository hygiene after this slice

Temporary screenshot/contact-sheet branches created by Local Agent are validation artifacts only and are not product branches. After the evidence was recorded and visually reviewed, all remaining `agent-artifacts/*` validation branches were deleted.

The active product branch contains no `.agent/screenshots/**` or `.agent/artifacts/**` files, and the Local Agent worktree was verified clean after the cleanup task. Generated test outputs, Playwright traces, APKs and screenshots must not be committed to the product branch unless a specific long-lived test fixture is intentionally added.

## Next work

Do **not** start another broad UX consistency sweep. The next implementation should come from an explicit product requirement or a concrete regression.

Reasonable future categories:

- richer Plug management/configuration;
- additional supported sensor/device profiles;
- additional Plug-owned automation types;
- targeted polish on a specific screen when a real usability issue is observed.

Preserve the Plug-owned automation model, single runtime owner and shell-owned feedback geometry.

## Normal workflow for the next implementation slice

```text
fresh branch + daemon
-> bounded preimplementation audit
-> smallest cohesive implementation
-> focused typecheck/gates/tests
-> exactly one final full pnpm check
-> commit/push
-> emulator or physical-device smoke when native/device/UI behavior needs it
```

## Documentation map

Canonical/current:

- `AGENTS.md` — operating rules and Local Agent contract;
- `docs/HANDOFF_NEXT_CHAT.md` — continuation state;
- `docs/architecture/overview.md` — current product/runtime/UI-shell architecture;
- `docs/architecture/refactor-boundaries.md` — responsibility boundaries and hotspot policy;
- `docs/product/next-functional-steps.md` — active roadmap.

Historical/reference only:

- `docs/plan.md` — historical MVP context;
- `docs/implementation/device-rule-decoupling-plan.md` — historical implementation plan;
- `docs/prompts/` — historical prompts;
- older implementation notes and ADRs remain evidence/context unless explicitly superseded.

If current behavior and an old historical plan disagree, current code + canonical docs above win.
