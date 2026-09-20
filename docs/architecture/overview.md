# Architecture overview

Updated: 2026-09-20

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

## Global feedback / toast architecture

`AppShell` also owns the single mobile toast host. Page-level flows may own their local toast queue/message state, but they must render it through `AppToastViewport`, which portals the shared `@lcl/ui` `ToastViewport` into `#app-toast-host`.

`AppToastViewport` never falls back to rendering a fixed toast inside the calling screen, including on the first render. Until the shell host exists it renders nothing; once the host is available it portals there. Direct screen tests that bypass `AppShell` use the shared `renderWithAppToastHost` test helper rather than weakening this production contract.

The host sits outside the scrollable page-content subtree and outside page cards/glass surfaces:

```text
AppShell
  -> scrollable page content
  -> app-toast-host
  -> persistent bottom navigation
```

This is intentional. CSS properties such as `backdrop-filter`, `filter`, `transform` or containment on a page/card can create a containing block for descendants. A raw `position: fixed` toast mounted inside such a surface can therefore become fixed to that surface instead of to the app viewport.

Toast geometry is owned at shell level and keeps the shared viewport immediately above the persistent bottom navigation, including the bottom safe-area inset. Do not add screen-specific toast offsets.

`scripts/quality/ux-gate.mjs` enforces this contract:

- mobile screens must not render raw `<ToastViewport>` directly;
- `AppShell` must provide the app toast portal target;
- the bottom-navigation stylesheet must retain the shared toast/nav geometry contract.

Responsive E2E coverage verifies the real toast/nav relationship across the canonical phone, tablet and desktop viewports.

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

### Mobile platform adapters

`apps/mobile/src/platform/*` owns cross-feature bindings to native/browser platform APIs. It may adapt Capacitor/browser transport into package clients, but it does not own product state, user-facing i18n decisions or feature orchestration. Shelly HTTP selection (browser dev proxy versus Capacitor native HTTP) lives here so installation, time-automation and hardware-setup flows do not depend on each other for transport.

### Mobile flows

`apps/mobile/src/flows/*` owns app orchestration and transport use. Hardware setup is composed from focused flows including:

- Shelly control/status,
- Shelly LAN scan,
- Shelly-side BLE discovery,
- sensor setup composition plus phone BLE discovery/live readings,
- climate automation installation.

`useHardwareSetupFlow` is a facade/composition hook. Do not move subsystem implementations back into it.

Plug add presentation/local state and Plug management-surface navigation state live under `apps/mobile/src/features/plugs`; Shelly transport and mutations remain in the hardware setup flows and are injected through narrow callbacks.

Shelly protocol response parsing and raw RPC request shapes belong to `@lcl/shelly-client`. `src/platform` owns cross-feature Shelly HTTP transport selection (browser/dev proxy/Capacitor) and the shared localized Result-to-Error boundary; product flows own orchestration.

### Screens

Screens compose flows into product UI. They must not call raw `fetch` or import the Capacitor BLE plugin directly. Hardware setup pages receive narrow page contracts rather than the full setup flow.

The first migrated `features/plugs` slice owns the manual/LAN Plug-add presentation and local UI state; the legacy hardware setup page remains the adapter from `ShellySetupFlow` to that feature surface.

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

`scripts/quality/ux-gate.mjs` additionally protects cross-screen UI contracts such as shell-owned toast hosting and other shared UX primitives.

These budgets and gates are regression alarms. Do not weaken or raise them to accommodate responsibility creep; extract a cohesive subsystem instead.

Current hotspot policy is documented in `docs/architecture/refactor-boundaries.md`.
