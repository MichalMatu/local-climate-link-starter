# Refactor boundaries

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
