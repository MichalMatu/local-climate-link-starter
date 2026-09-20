# Refactor boundaries

Updated: 2026-09-20

File size is an alarm, not a refactor goal. Refactor when ownership is unclear, lifecycle
or side effects are duplicated, transport leaks into presentation, or a touched file
would gain another unrelated responsibility.

## Preimplementation architecture gate

Before implementation, identify:

```text
product owner
state owner
side-effect owner
UI owner
final file layout
test owner
```

For a tiny local fix this may be one short note. For a cross-file change it must be
explicit enough that a reviewer can answer: **where does this responsibility belong after
the change?**

Do not intentionally implement a feature into the wrong owner with a plan to clean it up
later.

Ask these questions before coding:

- Does one module clearly own the mutable state?
- Does one flow/client clearly own the side-effect lifecycle?
- Will a screen remain presentation/composition rather than transport/domain code?
- Will a facade remain composition rather than absorb another subsystem?
- Will a shared UI primitive stay product-agnostic?
- Will the proposed file structure make the next related change easier to locate?
- Does a touched hotspot need a cohesive extraction before it grows again?

If the answer is no, repair the boundary as part of the implementation slice. Do not do a
broad repository rewrite.

## Enforced direction

```text
packages/domain + adapters
        ^
        |
mobile feature flows / stores
        ^
        |
screens / route composition
        ^
        |
shared UI primitives
```

More concretely:

- domain packages do not import React/Ionic;
- packages do not import from apps;
- screens do not call raw `fetch`;
- screens do not import the Capacitor BLE plugin;
- transport/runtime implementation belongs in clients/adapters/flows;
- durable persistence belongs behind repositories;
- pages consume narrow flow contracts;
- UI primitives do not make product/runtime ownership decisions.

`scripts/quality/repository-gate.mjs` is the executable boundary contract. Keep it green;
do not increase budgets merely to land a change.

## Mobile source organization

The current mobile source tree is historically organized by technical layer:

```text
src/
  app/
  components/
  flows/
  routes/
  screens/
```

Do not mass-migrate it.

For a new cohesive product capability, prefer gradual feature ownership:

```text
src/features/<feature>/
  screens/
  components/
  flows/
  state/
  data/
```

Only create the subdirectories the feature needs.

When materially changing an existing feature, migrate the touched cohesive slice only if
that reduces scatter and can be kept behavior-preserving. Do not mix a broad folder move
with unrelated product behavior.

`src/app` and `src/routes` remain app-composition boundaries. Truly cross-feature,
mobile-only presentation may remain in `src/components`. Product-agnostic reusable
presentation belongs in `@lcl/ui`.

Avoid catch-all folders such as `features/common`, `misc`, `helpers` or generic service
containers.

## Hardware setup boundary

`HardwareSetupScreen.tsx` is a coordinator. Its responsibilities are limited to:

- selecting the current setup page/tab;
- applying route/setup context;
- opening/closing local child pages;
- lifecycle cleanup for the setup surface.

It must not own Shelly RPC details, BLE parsing/scanning implementation or page-specific
presentation.

`useHardwareSetupFlow.ts` is a facade over cohesive subsystems. Current extracted
responsibilities include:

- `useShellyControlFlow`;
- `useShellySetupScanFlow`;
- `useShellyBleDiscoveryFlow`;
- `usePhoneSensorFlow`;
- `useClimateAutomationInstallFlow`.

Do not move those implementations back into the facade.

Hardware pages use narrow contracts such as `ShellySetupFlow`, `SensorSetupFlow`,
`RuleSetupFlow` and `TimeScheduleSetupFlow`. A page must not recover the complete
`HardwareSetupFlow` indirectly.

## Navigation/presentation boundary

`AppShell` owns persistent bottom navigation and application-frame overlay geometry.
Child pages own their working content.

Use:

```text
AppShell
  -> root page
     -> child page
        -> deeper child page
           -> modal only for a transient decision/confirmation
```

The mobile toast host is part of the shell boundary:

```text
AppShell
  -> scrollable page content
  -> app-toast-host
  -> persistent bottom navigation
```

Screens may own their toast message/queue state, but render through `AppToastViewport`.
Do not render raw `<ToastViewport>` in `apps/mobile/src/screens/**`, add screen-specific
toast offsets, or move the host into filtered/transformed page surfaces.

## File growth policy

New-file review alarms:

```text
mobile screen/page        ~300 lines
mobile flow/hook          ~350 lines
presentational component  ~250 lines
```

These are not targets and do not override responsibility. A cohesive file may exceed an
alarm with a clear reason; an incohesive file should be split before reaching it.

Existing large files are not an invitation to a mass cleanup. When a hotspot is touched,
ask whether the new change adds a responsibility. If yes, extract that responsibility
instead of increasing an architecture budget.

Repository-gate hard budgets remain authoritative for protected hotspots.

## Current watchlist

### `apps/mobile/src/__tests__/hardware-setup.test.tsx`

Large scenario file with valuable regression coverage. Split cohesive scenario groups
when this area is materially extended; do not rewrite it merely for line count.

### `apps/mobile/src/theme/theme.css`

Large global stylesheet. When touching a surface, remove stale selectors in that area and
prefer a feature-cohesive style boundary where natural. Do not start a repository-wide
CSS rewrite as a side quest.

### `ShellySetupPage.tsx`

Responsibility-dense but bounded to Shelly setup. If it gains another distinct task,
extract by task boundary rather than arbitrary line slices.

### `flows/hardware-setup/shellyRequests.ts`

Dense Shelly RPC boundary. Keep RPC details out of screens. Split into request families
only when unrelated RPC responsibilities make the current module hard to reason about.

### `useHardwareSetupFlow.ts`

Broad by design as a facade. New transport loops, timers, parsers or runtime ownership
must become focused flows/services rather than inline facade sections.

## When to refactor now

Refactor as part of the active task when at least one is true:

- two places own the same state or lifecycle;
- transport logic leaks into presentation;
- a screen/page needs the full flow only to reach one subsystem;
- a quality budget is exceeded;
- a change requires touching several unrelated branches of one file;
- stale CSS/test coupling repeatedly causes regressions;
- the proposed implementation would create a new god object or catch-all module.

Otherwise prefer the smallest cohesive product change and leave stable code alone.
