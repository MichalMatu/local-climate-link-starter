# AGENTS.md — apps/mobile

This contract applies to `apps/mobile/**` in addition to the repository root rules.

## Product/UI ownership

The mobile app is a configurator and management surface, not the installed automation
runtime.

Keep these product contracts stable unless the user explicitly changes them:

```text
AppShell
  -> Plugs
  -> Thermometers
  -> Settings

physical Plug -> optional installed automation
```

`AppShell` owns persistent bottom navigation and the global toast host. Page content owns
its working UI. Full tasks are pages/subpages; modals are for transient decisions,
confirmation, pickers, short previews or blocking errors.

Do not reintroduce a global automation dashboard as a root product section.

## Source organization

The current `src/{screens,flows,components,...}` layout is a transitional structure. Do
not perform a mass move only to make the tree look cleaner.

For **new cohesive product capabilities**, prefer feature ownership:

```text
src/features/<feature>/
  screens/
  components/
  flows/
  state/
  data/
```

Examples of product features are `plugs`, `thermometers`, `automations` and `settings`.
Create only the subdirectories the feature actually needs.

Rules:

- new product-specific code should live with its feature when practical;
- existing code may stay in `screens/`, `flows/` or `components/` until the touched slice
  has a real reason to move;
- when materially changing an existing feature, consider migrating only that cohesive
  slice if it reduces cross-folder scatter;
- do not mix a structural migration with unrelated behavior changes;
- `src/app` and `src/routes` remain for app composition/shell/routing;
- truly cross-feature mobile UI may remain in `src/components`;
- do not create `features/common`, `features/misc` or another dumping ground.

The goal is gradual feature ownership, not churn.

### Enforced feature boundary

`scripts/quality/feature-boundary-gate.mjs` makes this direction executable.

- legacy top-level `src/screens`, `src/flows` and `src/components` are frozen to their
  current production modules; new top-level product capabilities belong under
  `src/features/<feature>`;
- every feature has one public `index.ts` and private internal folders;
- external callers must use that feature public API;
- features do not depend on each other by default;
- a reviewed feature-to-feature dependency must still use the target public API;
- feature code must not depend back on legacy `src/screens`, `src/routes` or `src/flows`;
- package subpath imports must match an explicit workspace `package.json#exports` entry;
- feature presentation cannot own raw fetch/BLE/storage;
- feature-specific CSS stays out of the global theme.

Read `src/features/AGENTS.md` before changing or creating any feature.

## Mobile preimplementation gate

Before adding a screen/flow/store, name the owners:

```text
route/screen composition
feature orchestration
server/device state
local UI state
durable persistence
BLE/network/timer side effects
shared presentation
```

A responsibility must have one obvious owner.

If a proposed change needs edits across many unrelated branches of one file, first
extract the cohesive responsibility. If it only makes a file shorter without improving
ownership, do not refactor it.

## Layer responsibilities

### Screens and routes

Screens:

- compose feature flows and presentation;
- translate route context into typed props;
- render loading/empty/success/error states;
- do not call raw `fetch`;
- do not import the Capacitor BLE plugin;
- do not perform Shelly RPC directly;
- do not own persistence or reusable domain algorithms.

Routes select screens and navigation state. They do not become feature stores.

### Flows

Flows own app orchestration and side-effect lifecycles:

- BLE scan start/stop;
- RPC sequences;
- install/uninstall orchestration;
- timers/polling scoped to a feature;
- translating package APIs into UI-consumable state.

A facade such as `useHardwareSetupFlow` composes focused subsystems. It must not absorb
their implementations.

### State and persistence

- TanStack Query owns asynchronous device/server state where applicable.
- Zustand is for small local app/feature state.
- Durable state goes through a repository/storage boundary.
- Do not scatter `localStorage`, Capacitor Preferences or ad-hoc storage calls through
  screens/components.
- Avoid multiple booleans for a workflow state when a discriminated state is clearer.

### Components

Components receive typed data and emit typed events. They must not own BLE/RPC/storage
lifecycles or product-wide runtime ownership decisions.

Promote a component to `@lcl/ui` only when it is genuinely product-agnostic and reusable.

## UX contract

The UI should be minimal, calm, precise and information-dense without becoming cramped.

Rules:

- data and controls come before decorative framing;
- do not repeat a heading/label in helper text;
- avoid filler subtitles and obvious status badges;
- use compact rows for a handful of parameters instead of oversized cards;
- primary actions belong where the interaction expects them: page action area or modal
  footer, not arbitrary empty space;
- standalone actions align with the established action edge or intentionally use full
  width on mobile;
- standalone Add Plug and Add Thermometer pages must never render `AppPageBack`, a custom Back button, or another page-local return control; users return with persistent bottom navigation or platform/browser Back;
- use shared patterns before creating one-off card/button/status styles;
- user-facing copy goes through i18n;
- technical detail belongs in diagnostics;
- all controls require accessible labels and usable touch targets.

Use design tokens. Do not hardcode colors or repeated spacing in components.

## Toast and overlay boundary

Mobile screens render short-lived feedback through `AppToastViewport`, which portals the
shared `@lcl/ui` `ToastViewport` into the `AppShell`-owned `#app-toast-host`.

Never:

- render raw `<ToastViewport>` from `screens/**`;
- add screen-specific toast `bottom` offsets;
- place the global toast host inside filtered/transformed page surfaces;
- move persistent bottom navigation ownership out of `AppShell`.

## Hardware setup special boundary

`HardwareSetupScreen.tsx` is a coordinator, not a subsystem implementation.

`useHardwareSetupFlow.ts` is a facade over focused flows such as Shelly control, LAN
scan, Shelly BLE discovery, phone BLE and automation installation. Keep subsystem
implementations out of the facade.

Hardware setup pages consume narrow contracts (`ShellySetupFlow`, `SensorSetupFlow`,
`RuleSetupFlow`, `TimeScheduleSetupFlow`) rather than the complete setup flow.

Do not raise existing repository-gate budgets to fit new responsibilities.

## File growth alarms

For new files, treat these as review alarms, not arbitrary split targets:

```text
screen/page component    ~300 lines
feature flow/hook        ~350 lines
presentational component ~250 lines
```

Crossing an alarm is acceptable only when the file still has one cohesive responsibility
and splitting would make ownership worse. Existing larger files are not a mandate for a
mass refactor.

If a touched hotspot grows because of a **new responsibility**, extract that
responsibility rather than increasing the budget.

## Tests and visual validation

Add focused tests for changed behavior and failure states.

For layout/overlay/navigation regressions, validate representative viewports:

```text
360x800
390x844
412x915
768x1024
1440x900
```

Use responsive Playwright/screenshot evidence when geometry matters. Check wrapping,
clipping, safe areas, persistent navigation, modal geometry, toast placement, touch
targets, loading/empty/error/success states and visual hierarchy.

Physical-device absence does not block unrelated TypeScript/web work. Native-only claims
require a working emulator or physical device and must state which one supplied evidence.
