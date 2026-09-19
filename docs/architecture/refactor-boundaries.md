# Refactor boundaries

Updated: 2026-09-20

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

- selecting the current setup page/tab;
- applying route/setup context;
- opening/closing local child pages where needed;
- lifecycle cleanup when the whole setup surface leaves.

It must not own Shelly RPC details, BLE parsing/scanning implementation or page-specific presentation.

`useHardwareSetupFlow.ts` is a facade over cohesive subsystems. Current extracted responsibilities include:

- `useShellyControlFlow`;
- `useShellySetupScanFlow`;
- `useShellyBleDiscoveryFlow`;
- `usePhoneSensorFlow`;
- `useClimateAutomationInstallFlow`.

Do not move those implementations back into the facade.

Hardware pages use narrow contracts such as `ShellySetupFlow`, `SensorSetupFlow`, `RuleSetupFlow` and `TimeScheduleSetupFlow`. A page must not recover the complete `HardwareSetupFlow` indirectly.

## Navigation/presentation boundary

`AppShell` owns persistent bottom navigation and application-frame overlay geometry. Child pages own their working content. A full working task should be a page/subpage; modal scope is limited to transient decisions, confirmations, short previews, pickers or errors.

The global mobile toast host is part of that shell boundary:

```text
AppShell
  -> scrollable page content
  -> app-toast-host
  -> persistent bottom navigation
```

Screens may own their toast message/queue state, but they render through `AppToastViewport`, which portals the shared `@lcl/ui` `ToastViewport` into `#app-toast-host`. Do not render raw `<ToastViewport>` in `apps/mobile/src/screens/**`, add screen-specific toast `bottom` offsets, or move the host into filtered/transformed page surfaces. `scripts/quality/ux-gate.mjs` protects this contract.

The completed Plug/Thermometer add pages establish the discovery-card presentation contract. Reuse its principles before inventing another one-off layout, but do not prematurely generalize unrelated screens into one component.

Saved Plug settings and BLE discovery follow the same page-tree rule both from the main dashboard and inside the configurator. Do not regress those working surfaces back into modal-first navigation.

## Current architecture checkpoint

Latest verified app-code checkpoint:

```text
8ad5b152bdbf861a8e6620414245dfbcb06c0ead
Anchor app toasts above bottom navigation
```

Documentation commits follow that app-code checkpoint on the active work branch, so always fetch the fresh branch before writing.

At this checkpoint:

- repository architecture and UX gates pass;
- one full `pnpm check` passes;
- `HardwareSetupScreen` remains a coordinator rather than an all-purpose setup screen;
- `useHardwareSetupFlow` composes dedicated flows and remains protected by its size/public-surface alarms;
- Shelly/Sensor/Rule pages keep explicit composition budgets;
- phone BLE and Shelly discovery lifecycle ownership remains outside route/shell code;
- BLE child-page cleanup safely handles Back during scanner startup;
- `RuleAdvancedSettingsModal.tsx` remains deleted as dead code and active advanced settings remain inline;
- `AppShell` owns the global toast host while `@lcl/ui` owns the reusable toast primitive;
- `quality:ux` rejects raw screen-level toast viewports and protects the shell host/nav geometry;
- responsive toast/nav coverage exercises 360×800, 390×844, 412×915, 768×1024 and 1440×900.

There is no current reason for a broad architecture rewrite or another broad UX consistency sweep before explicit product work.

## Watchlist

### `apps/mobile/src/__tests__/hardware-setup.test.tsx`

This is the clearest god-file risk. It is intentionally scenario-heavy and provides valuable end-to-end regression coverage, but it has accumulated many unrelated hardware-setup scenarios.

When this area is next materially expanded, prefer moving cohesive scenario groups into separate test files while preserving behavior and shared helpers. Do not rewrite it solely to make it shorter.

The focused suite still emits React Testing Library `act(...)` warnings from the frozen standalone device-add regression test. These do not fail lint/tests and are not by themselves a reason to reopen the completed Add Plug/Add Thermometer UI.

### `apps/mobile/src/theme/theme.css`

This is a large global stylesheet and can hide stale selectors or cross-screen overrides.

When a screen is actively refactored:

- remove dead selectors in the touched area;
- prefer a feature-cohesive style boundary when there is a natural one;
- keep design tokens shared;
- avoid a repository-wide CSS rewrite as an unrelated side quest.

Glass styling is allowed on major surfaces, but geometry-critical overlays must remain outside filtered/transformed page containers unless their positioning contract explicitly accounts for that.

### `ShellySetupPage.tsx`

The page is bounded to Shelly setup, but it still coordinates saved-device management, add/manual/scan presentation, transient removal confirmation and fallback settings/BLE modal components.

The normal dashboard/configurator working flows use page callbacks for saved settings and BLE discovery. Keep those page routes primary. If the fallback modal path is later proven unreachable, remove it in a dedicated cleanup with exact reference/tests rather than assuming it is dead.

If new responsibilities are added, extract by concrete task, not by arbitrary line slices.

### `flows/hardware-setup/shellyRequests.ts`

This service is a dense Shelly RPC boundary. Keep RPC details here/out of screens, but split into cohesive request families if new unrelated RPC responsibilities make it harder to reason about or test.

### `useHardwareSetupFlow.ts`

Broad by design as a facade. Keep it composition-focused. New transport loops, timers, parsers or runtime ownership should become focused flows/services rather than new inline sections.

## When to refactor

Refactor now when at least one is true:

- two places own the same state or lifecycle;
- transport logic leaks into presentation;
- a screen/page needs the full flow only to reach one subsystem;
- a quality budget is exceeded;
- a change requires touching several unrelated branches of one file;
- stale CSS/test coupling causes repeated regressions.

Otherwise prefer the smallest product change and leave stable code alone.
