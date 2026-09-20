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

## Mobile platform-adapter boundary

`apps/mobile/src/platform/*` is the neutral owner for cross-feature browser/Capacitor bindings. Platform adapters may construct package transports and normalize platform APIs, but must not own feature state, product workflows or user-facing translations. Product flows depend on platform adapters; platform adapters must not depend on product flows/screens/features.

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

- `useShellyControlFlow` (Shelly verification, setup status and relay control);
- `useShellySetupScanFlow` (including LAN scan concurrency/abort orchestration);
- `useShellyBleDiscoveryFlow`;
- `useSensorSetupFlow` composing `usePhoneSensorFlow`;
- `useClimateAutomationInstallFlow`.

Do not move those implementations back into the facade.

Hardware pages use narrow contracts such as `ShellySetupFlow`, `SensorSetupFlow`,
`RuleSetupFlow` and `TimeScheduleSetupFlow`. A page must not recover the complete
`HardwareSetupFlow` indirectly.

`features/plugs` owns the migrated Plug-add surface (manual entry and LAN scan presentation/local UI state). `ShellySetupPage` remains a legacy coordinator/adapter while the rest of the Plug setup surface is migrated incrementally.

`features/automations` owns managed Shelly automation status, deployed-script reads, the deployed climate-script load/decode lifecycle and the native Shelly time-schedule runtime lifecycle. Legacy setup/query hooks compose that feature through its public API rather than owning those implementations. Pure daily-clock and relay-window calculations live in `@lcl/automation-core`.

## Script generator boundary

`@lcl/script-generator` keeps generated-runtime responsibilities separate: `shelly/generate.ts`
owns thermostat runtime composition, `shelly/discovery.ts` owns BLE discovery scan/endpoint
composition, and `shelly/discoveryParsing.ts` owns the generated advertisement parsing
runtime. These private modules preserve the existing package public API.

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

`@lcl/shelly-client` keeps Shelly device/status response normalization in `src/rpc/deviceStatus.ts`. `scripts/installLifecycle.ts` owns backup/upload/start/verification for script installation, while `scripts/install.ts` remains the public client facade.
`src/rpc/relay.ts` owns relay mutation and safe relay-test orchestration, while `src/rpc/errors.ts` owns shared client-side validation/relay error construction.

## Phase 1 mechanical guardrails

The Phase 0 ownership rules are now enforced mechanically by
`scripts/quality/repository-gate.mjs`.

The gate protects the hierarchical agent-contract structure:

```text
AGENTS.md                 <= 300 lines
apps/mobile/AGENTS.md     <= 260 lines
packages/AGENTS.md        <= 220 lines
packages/ui/AGENTS.md     <= 140 lines
scripts/quality/AGENTS.md <= 180 lines
```

These limits are intended to stop the root contract from becoming another historical
catch-all. Area-specific rules belong in the nearest nested contract.

The gate also freezes the current workspace package direction:

```text
automation-core  -> no @lcl package dependency
ble-core         -> device-profiles
design-tokens    -> no @lcl package dependency
device-profiles  -> no @lcl package dependency
diagnostics      -> no @lcl package dependency
script-generator -> automation-core + device-profiles
shelly-client    -> diagnostics
ui               -> design-tokens
```

Any new cross-package dependency is an architecture change, not a convenience import.
The gate also rejects package-source imports from `apps/*`; `@lcl/ui` may not gain another
`@lcl/*` dependency besides design tokens or become Capacitor/Ionic-aware.

For production TypeScript modules, the default hard growth budget is **350 lines**.
Tests and locale data are excluded because line count there does not represent runtime
ownership in the same way. Phase 3 tightened known larger modules to their exact current
parser counts in `scripts/quality/architecture-baseline.mjs`:

```text
apps/mobile/src/screens/AutomationDashboardScreen.tsx                  600
apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx         558
apps/mobile/src/screens/InstallationDetailScreen.tsx                   458
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx       416
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx 411
apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx         353
```

These values are accepted debt, not spare capacity. Do not raise a baseline because a
feature was implemented in the easiest existing file. If a hotspot needs a new
responsibility, create/extract the correct owner. If a protected hotspot shrinks, lower
its baseline when practical.

## Phase 3 tooling closeout

Phase 3 closes the architecture-tooling loop without refactoring product behavior:

- reviewed mutable baselines are centralized in
  `scripts/quality/architecture-baseline.mjs`;
- the workspace package DAG, exact oversized-module counts, recursive legacy mobile paths,
  reviewed feature dependencies and shared stylesheet counts have one executable source of
  truth;
- legacy `screens/`, `flows/` and `components/` are frozen recursively, so a new
  product capability cannot bypass `features/<feature>` by nesting deeper in legacy
  folders;
- `pnpm quality:selftest` exercises deterministic positive and negative fixture cases for
  both architecture gates;
- `pnpm quality:repo` runs repository gate, feature gate and the gate self-test suite;
- `scripts/quality/AGENTS.md` is itself protected by the repository gate.

The tooling should now be changed only when concrete product work exposes a specific gap.
Do not invent another broad hardening phase.

## Current audit baseline

The Phase 1 audit on 2026-09-20 found no package dependency violation or current
repository-gate architecture failure. It intentionally did **not** trigger a broad
refactor.

Largest production ownership hotspots at that checkpoint were:

```text
723  apps/mobile/src/flows/hardware-setup/shellyRequests.ts
673  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
599  apps/mobile/src/screens/AutomationDashboardScreen.tsx
582  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx
523  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
629  packages/shelly-client/src/scripts/install.ts
564  packages/script-generator/src/shelly/generate.ts
3334 apps/mobile/src/theme/theme.css
```

These numbers are evidence for where to be careful, not targets to preserve and not a
request to split files mechanically.

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

Mobile Shelly adapter/orchestration boundary. Raw Shelly RPC request shapes and response
validation belong to `@lcl/shelly-client`; this module keeps platform transport selection and
user-facing error translation. Split further only along a real request-family ownership boundary.

### `AutomationDashboardScreen.tsx`

Large root Plug surface. Keep it at screen-composition/presentation level. New device
transport, persistence or automation-domain behavior must not be added directly here; a
materially new dashboard task should get a focused feature owner.

### `useHardwareSetupFlow.ts`

Broad by design as a facade. New transport loops, timers, parsers or runtime ownership
must become focused flows/services rather than inline facade sections.

### `packages/shelly-client/src/scripts/install.ts`

Large but cohesive install/runtime-mutation pipeline. New unrelated Shelly management
operations should get their own module instead of extending the install pipeline.

### `packages/script-generator/src/shelly/generate.ts`

Large deterministic generator. Keep generated behavior derived from typed configuration.
When adding a genuinely different automation/runtime family, prefer a cohesive generator
boundary rather than another unrelated branch in this file.

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
