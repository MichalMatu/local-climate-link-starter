# AGENTS.md — Local Climate Link

This file is the operating contract for Codex agents working in this repository.
Keep this file practical, short enough to load fully, and update it whenever the project architecture or commands change.

---

## 0. Local hardware test authority

In this project, toggling the local Shelly test plug relay ON and OFF is safe.
The user has explicitly authorized real hardware tests that switch the Shelly
relay through Local Climate Link scripts or `Switch.Set`. Do not slow testing by
asking for separate approval, warning that ON/OFF is unsafe, or avoiding relay
changes. Real Shelly tests should include actual ON and OFF transitions whenever
that is relevant to the requested validation.

This authority applies to the local development Shelly device and Local Climate
Link test scripts. Still avoid unrelated destructive actions, and after tests
leave the final relay state explicit and known.

---

## 1. Product mission

Build **Local Climate Link**: an ultra-light mobile configurator for local BLE → smart plug automations.

The MVP is:

```text
Xiaomi LYWSD03MMC / PVVX / BTHome v2
or TP357 custom BLE beacon
        ↓
Local Climate Link mobile app configures the system once
        ↓
Shelly Plug S Gen3 runs a local Shelly Script
        ↓
local relay ON/OFF
```

The mobile app is **not** the runtime automation controller. The app only discovers devices, validates compatibility, generates configuration, uploads Shelly Script, runs safe tests, and shows diagnostics. After setup, Shelly must work without the phone, cloud, Home Assistant, MQTT broker, Docker, YAML, or server running 24/7.

Primary user promise:

```text
Termostat bez huba.
Termometr BLE + gniazdko Shelly.
Konfigurujesz raz w aplikacji, działa lokalnie.
```

---

## 1A. Development mode: no backward compatibility

This project is in active development. Do not add migrations, legacy adapters,
compatibility aliases, dual config shapes, old storage readers, fallback request
fields, or backward-compatible UI/test contracts unless the user explicitly asks
for them in the current task.

When replacing an internal API, persisted draft shape, request field, config
schema, UI route, or test contract, update current callers and delete the old
shape in the same change. Development data may be reset. Prefer a hard failure or
fresh default over preserving legacy test/demo data.

---

## 2. Non-negotiable MVP constraints

### Must do

- Support `Shelly Plug S Gen3` as the first output/controller.
- Support `Xiaomi LYWSD03MMC / PVVX / BTHome v2` as the first sensor.
- Support `TP357` as the second sensor through a dedicated parser/profile.
- Generate a local Shelly Script with:
  - BLE scan,
  - sensor filtering,
  - BTHome or TP357 parsing,
  - thermostat/hygrostat decision logic,
  - relay control through local `Switch.Set`,
  - failsafe OFF on stale sensor,
  - safe boot OFF,
  - minimum relay change interval,
  - diagnostics.
- Keep core automation deterministic and testable as pure TypeScript before rendering UI or generating scripts.
- Require a safe relay test before the user connects a heater or other 230 V load.

### Must not do in MVP

- Do not make the phone run automation in the background.
- Do not require Home Assistant.
- Do not require MQTT in the default flow.
- Do not require cloud services.
- Do not flash Shelly with alternative firmware.
- Do not support dozens of random devices before the first two sensor profiles and Shelly path are stable.
- Do not expose JavaScript editing as the normal user flow.
- Do not hide Matter/script/BLE incompatibility behind vague errors.

---

## 3. Stack decision

Use this stack unless the user explicitly approves a change:

```text
Monorepo: pnpm workspaces
Language: TypeScript, strict mode
Mobile shell: Ionic React + Capacitor
BLE: @capacitor-community/bluetooth-le
Runtime validation: Zod
Server/cache state: TanStack Query
Small local UI/app state: Zustand
Tests: Vitest + React Testing Library
E2E/smoke where practical: Playwright for web/demo flows
Formatting/linting: ESLint + Prettier
Design tokens: Style Dictionary -> CSS variables / TS tokens
```

Do not switch to Flutter, React Native, Expo, Firebase, Supabase, Redux, MobX, or a different BLE plugin without a written decision record and user approval.

---

## 4. Expected repository layout

Create and maintain this structure:

```text
/apps/mobile
  src/
    app/
    routes/
    flows/
    screens/
    components/
    theme/
    permissions/
    mocks/

/packages/ble-core
  src/
    adapters/
    parsers/
    scanner/
    model.ts

/packages/device-profiles
  src/
    sensors/
    outputs/
    schemas.ts

/packages/automation-core
  src/
    thermostat/
    humidistat/
    failsafe/
    simulator/
    model.ts

/packages/shelly-client
  src/
    rpc/
    discovery/
    scripts/
    backup/
    model.ts

/packages/script-generator
  src/
    shelly/
    templates/
    validators/

/packages/design-tokens
  tokens/
  build/

/packages/ui
  src/
    primitives/
    feedback/
    forms/
    layout/

/packages/diagnostics
  src/
    logger.ts
    redaction.ts
    export.ts

/docs
  architecture/
  adr/
  compatibility/
  testing/
  troubleshooting/
  user-guides/

/examples
  shelly-scripts/
  sample-configs/

/legal
  THIRD_PARTY_NOTICES.md
  privacy-mvp.md
```

Keep modules independent. The mobile app composes packages; it must not become the place where domain logic lives.

---

## 5. Dependency direction rules

Allowed dependency direction:

```text
apps/mobile
  -> packages/ui
  -> packages/design-tokens
  -> packages/ble-core
  -> packages/device-profiles
  -> packages/automation-core
  -> packages/shelly-client
  -> packages/script-generator
  -> packages/diagnostics

script-generator -> automation-core, device-profiles
shelly-client    -> diagnostics only for redaction/log helpers
ble-core         -> device-profiles only when matching known profiles
ui               -> design-tokens only
```

Forbidden:

- `automation-core` importing React, Ionic, Capacitor, browser globals, or Shelly client.
- `ble-core` importing React/Ionic screens.
- `script-generator` importing UI components.
- UI screens directly calling Capacitor BLE or Shelly RPC.
- Packages importing from `apps/mobile`.
- Circular dependencies.

If a dependency feels convenient but violates this graph, create an interface or adapter instead.

---

## 6. Core domain model rules

Use explicit domain types. Avoid primitive soup.

Preferred patterns:

```ts
export type SensorProfileId = 'xiaomi_lywsd03mmc_bthome_v2' | 'tp357_custom_v1';

export type OutputProfileId = 'shelly_plug_s_gen3';

export type AutomationMode = 'heating' | 'cooling' | 'humidifying' | 'dehumidifying';

export interface Measurement {
  sensorId: string;
  source: 'phone-scan' | 'shelly-scan' | 'demo';
  temperatureC?: number;
  humidityPct?: number;
  batteryPct?: number;
  rssi?: number;
  seenAtMs: number;
}
```

Rules:

- Include units in names: `temperatureC`, `humidityPct`, `staleTimeoutSec`, `minChangeMs`.
- Validate external data with Zod at boundaries.
- Use discriminated unions for sensor profiles, output profiles, and errors.
- Return typed results from domain functions. Do not throw for ordinary invalid input.
- Throw only for programmer errors that should fail tests.
- Never store generated code as the source of truth. Store JSON config and generate script from it.

---

## 7. TypeScript code style

Required:

- `strict: true`.
- No implicit `any`.
- No explicit `any` unless a comment explains why and an issue/TODO is added.
- Prefer `unknown` + Zod validation for external inputs.
- Prefer pure functions in packages.
- Prefer named exports.
- Prefer small files with one responsibility.
- Prefer immutable data and return new objects instead of mutating inputs.
- Use `AbortController` or explicit timeout wrappers for network/RPC calls.
- Use exhaustive `switch` with `assertNever` for discriminated unions.

Avoid:

- Large god objects.
- Boolean flags that should be a union type.
- Stringly typed command names spread across the codebase.
- Hidden global state.
- Silent catch blocks.
- Logging raw secrets, Wi-Fi credentials, tokens, or full diagnostic payloads.

Example result type:

```ts
export type Result<T, E extends AppError = AppError> =
  { ok: true; value: T } | { ok: false; error: E };
```

---

## 8. React/Ionic architecture

Use screens as orchestration shells only.

Preferred structure:

```text
screens/AddSensorScreen.tsx      // screen layout and route-level composition
flows/add-sensor/useAddSensor.ts // flow state machine / orchestration
components/SensorCard.tsx        // presentational
packages/ble-core                // scanner/parser logic
```

Rules:

- Keep business logic out of React components.
- Do not call BLE plugin or Shelly RPC directly from components.
- Components receive typed props and emit typed events.
- Long flows should be modeled as small state machines, not many unrelated booleans.
- Use TanStack Query for async operations that fetch/check/execute remote state.
- Use Zustand only for local app state such as selected setup draft, preferences, and UI flags.
- Persist user setup only through a small storage repository interface; do not scatter `localStorage` or Capacitor Preferences calls.
- Every screen must have loading, empty, success, and error states.
- Every destructive action must have a clear confirmation and recovery path.

Avoid:

- `useEffect` chains for business workflows.
- Component files over roughly 250 lines without a clear reason.
- Inline object literals for complex config.
- Repeating device compatibility text in many components; use profiles and i18n keys.

---

## 9. BLE implementation rules

BLE must be wrapped behind interfaces so the app can run in demo mode and tests.

Required abstraction:

```ts
export interface BleScanner {
  startScan(options: ScanOptions): AsyncIterable<NormalizedBleAdvertisement>;
  stopScan(): Promise<void>;
}
```

Rules:

- Normalize Capacitor scan results at the boundary.
- Parser functions must be pure and testable with byte arrays/fixtures.
- Do not assume iOS exposes the real MAC address. Treat phone scan ID as unstable unless confirmed by Shelly discovery or profile-specific data.
- Keep phone BLE scanning for setup/UX only. Do not make the phone the runtime controller.
- Filter by service UUID/manufacturer data/profile as early as possible.
- Always stop scans when leaving a screen or cancelling a flow.
- Debounce UI updates from scan streams.
- Keep raw BLE payloads out of normal logs. Allow sanitized payloads only in explicit diagnostic export.

Parser output must be normalized:

```ts
export interface ParsedSensorAdvertisement {
  profileId: SensorProfileId;
  measurement: Measurement;
  confidence: 'high' | 'medium' | 'low';
  rawKind: 'bthome-v2' | 'tp357-custom';
}
```

For Xiaomi BTHome v2:

- Parse enough in the app to show live setup data.
- Generated Shelly Script may use `BTHome.parseData()` for runtime.
- Support unencrypted BTHome v2 first.
- Encrypted BTHome/bind key is not MVP unless explicitly requested.

For TP357:

- Keep parser in `packages/ble-core/src/parsers/tp357.ts`.
- Keep equivalent Shelly Script parser generation in `packages/script-generator`.
- Use the same fixture payloads for TypeScript parser tests and generated script tests when possible.

---

## 10. Shelly client rules

All Shelly communication goes through `packages/shelly-client`.

Required operations:

```text
Shelly.GetDeviceInfo
Shelly.GetStatus
Script.List
Script.Create
Script.Stop
Script.PutCode
Script.SetConfig
Script.Start
Script.GetStatus
Switch.GetStatus
Switch.Set
```

Rules:

- Every RPC call must have timeout handling.
- Every RPC response must be validated with Zod or a narrow parser.
- Before script replacement, back up existing script metadata and code when possible.
- Generated script name must be stable: `Local Climate Link Thermostat` or equivalent constant.
- Script must be set to run on boot.
- After upload, verify status and wait for first useful diagnostic event where possible.
- Relay test must use safe short ON then OFF.
- If Matter is active and scripts are unavailable, stop the flow and show a clear user action.
- Do not require Shelly Cloud.

Avoid:

- Hardcoding user IPs or MACs in code.
- Concatenating RPC URLs unsafely.
- Ignoring RPC errors.
- Retrying relay commands indefinitely.
- Leaving relay ON after a failed test.

### Developer hardware mode

When working with the local development Shelly device, treat existing Local
Climate Link Shelly scripts as disposable test artifacts. Prefer
deleting/replacing stale `Local Climate Link ...` scripts over building
compatibility, migration, backup, or recovery paths around them. Do not preserve
old test scripts, old script IDs, or old generated-code variants unless the user
explicitly asks for that.

The user has granted standing authorization for local development smoke tests to
toggle the Shelly relay ON and OFF through `Switch.Set` or generated Local
Climate Link scripts without asking for separate approval each time. ON and OFF
are safe on this local test plug. Use real relay transitions in hardware tests
when they validate the behavior under test, verify the final relay state, and
report that final state.

This developer shortcut applies to Local Climate Link test scripts on the local
Shelly device only. Do not delete unrelated user scripts unless explicitly
requested.

---

## 11. Shelly Script generation rules

Generated scripts are safety-critical.

Rules:

- Generate from typed JSON config, never from arbitrary user code.
- Escape all inserted strings.
- Put config at the top of the script in a small `CFG` object.
- Add a generator version comment.
- Add a config hash comment to detect drift.
- Keep script deterministic: same config -> same script text.
- Keep a minimal script for V1. Do not include unused parsers.
- Include failsafe OFF on stale sensor and boot.
- Include `minChangeMs` / relay anti-chatter logic.
- Include `maxOnMs` for heating profiles.
- Include `rssiMin` and sensor filtering.
- Include diagnostics fields: `lastSeen`, `lastTemp`, `lastRssi`, `relayState`, `lastReason` where practical.
- Add snapshot tests for generated script output.
- Add tests that validate placeholders were fully replaced.

Forbidden:

- `eval` or dynamic code execution.
- Pulling remote code at runtime.
- Runtime dependency on Home Assistant, MQTT, or cloud.
- Generating scripts that default to relay ON.
- Generating scripts without stale sensor OFF for heating.
- Adding multiple unrelated automations into the V1 script.

---

## 12. Automation engine rules

`packages/automation-core` is the single source of truth for decision logic.

Thermostat behavior for heating:

```text
temp < onBelow   -> request relay ON
temp > offAbove  -> request relay OFF
sensor stale     -> relay OFF
boot/start       -> relay OFF
max ON exceeded  -> relay OFF
```

Rules:

- Implement automation as pure functions with explicit inputs and outputs.
- Test edge cases around exact thresholds.
- Test `minOnTime`, `minOffTime`, `minChangeMs`, stale timeout, max ON time, and consecutive hits.
- Do not duplicate logic in UI and script generator. Generator should translate the domain model to script code.
- Add simulator helpers for UI previews and tests.

Avoid:

- Comparing temperatures in UI code.
- Hidden timers inside pure engine functions.
- Mixing live wall-clock time with logic; pass `nowMs` explicitly.

---

## 13. Design tokens and styling

Use design tokens from day one.

Visual direction:

- The product UI should feel minimal, calm, and precise: closer to Apple-style utility than dashboard noise.
- Data and controls come first. Descriptions, badges, helper boxes, and decoration are allowed only when they reduce real uncertainty or prevent a mistake.
- Use restrained color. Prefer neutral surfaces, clear hierarchy, and semantic accents. Do not tint whole screens or repeated UI blocks just to make them feel designed.
- Optimize for dense but readable information. A handful of fields belongs in compact rows, not large tiles or tall cards.
- Use whitespace deliberately to separate groups; do not create large empty areas because controls are placed in the wrong part of a modal or page.
- Repeated saved items may be cards. Page sections, modal bodies, and diagnostic summaries should be compact layouts unless framing is genuinely useful.
- Primary actions for a modal belong in the modal footer. Secondary contextual help belongs in the header or an info tooltip. The modal body is for the actual data or form.
- Standalone action buttons in toolbars, page headers, cards, and compact
  panels should either align with the app's action edge, normally the right
  side, or intentionally stretch full width on mobile. A lone button stuck to
  the left edge is not an acceptable default.
- Status badges are only for states that change the user's decision. Do not badge obvious states such as an item being listed, selected, supported, or already saved when the surrounding UI makes that clear.

Required token categories:

```text
color
spacing
radius
typography
shadow
motion
z-index
semantic status colors
```

Rules:

- Tokens live in `packages/design-tokens/tokens`.
- Generated outputs go to mobile theme CSS variables and TS token exports.
- Ionic theme variables should be mapped from tokens, not hand-written ad hoc.
- Components use semantic tokens, for example `--lcl-color-status-danger-bg`, not raw hex values.
- Breakpoints and reusable layout dimensions must be represented in design tokens. CSS media queries may use literal token values because CSS custom properties cannot drive media queries directly, but the value must exist under `breakpoint` tokens and pass `pnpm quality:ux`.
- No hardcoded colors in components.
- No hardcoded spacing except trivial `0`.
- No one-off CSS classes for repeated patterns; create a UI primitive.
- Transient success/error/loading feedback must not be inserted into cards, saved-device rows, toolbars, or button groups in a way that shifts primary controls. Use the shared toast primitive for short-lived feedback, and use modals or reserved diagnostic panels for blocking or persistent detail.
- Use accessible contrast for status colors.
- Use status language consistently: OK, warning, blocked, error, inactive.

Allowed:

- Inline style only for dynamic numeric values that cannot reasonably be expressed with classes/tokens, such as measured progress width.

Forbidden:

- Random hex colors in components.
- Tailwind utility soup mixed with Ionic variables unless the stack decision explicitly adds Tailwind.
- Recreating the same card/button/status badge styles in multiple screens.

---

## 14. UX copy and localization

Default UI language for MVP is Polish, but code identifiers stay English.

Rules:

- User-facing text must be simple and non-technical in the main flow.
- Prefer no text over filler text. Every sentence must answer a real user question, explain a consequence, or give the next action.
- Do not repeat what the heading, field label, button, or list already says. Avoid "masło maślane" such as "Lista dodanych gniazdek" followed by "Dodane gniazdka".
- Keep titles literal and short. Use subtitles only when they add missing context.
- Use placeholders as examples, not as instructions. Use labels for meaning and validation messages for corrections.
- Put optional background information in an info tooltip, not as a permanent block that pushes data down.
- Error copy must be short, specific, and actionable: what went wrong and where to check next.
- Empty states should be one concise sentence plus a clear next action if needed.
- Technical details belong in diagnostics.
- Prefer: `Nie widzę czujnika od 15 minut`.
- Avoid: `BLE advertisement stale timeout exceeded`.
- Always explain safety states in plain language.
- Add i18n keys for all user-facing strings.
- Do not hardcode Polish text inside package logic; keep it in the app/i18n layer.

Required key user messages:

```text
Dodaj termometr
Dodaj gniazdko
Ustaw próg
Przetestuj
Gotowe — działa lokalnie
Matter jest włączony. Lokalny termostat wymaga Shelly Scripts.
Nie widzę czujnika od X minut.
Dla grzania domyślny tryb bezpieczeństwa to OFF.
```

---

## 15. Testing policy

Every meaningful change must include tests unless it is documentation-only or a trivial copy change.

Required test layers:

### Unit tests

- BLE parser fixtures:
  - Xiaomi BTHome v2 temperature/humidity/battery.
  - TP357 valid payload.
  - malformed payloads.
  - missing fields.
- Automation engine:
  - heating ON/OFF thresholds.
  - stale timeout.
  - min change guard.
  - max ON guard.
  - boot OFF.
- Script generator:
  - deterministic snapshots.
  - config values inserted correctly.
  - no unreplaced placeholders.
  - failsafe sections present.
- Shelly client:
  - RPC request shape.
  - success and error parsing.
  - timeout behavior.
  - retry policy where used.
- Diagnostics redaction:
  - no secrets in exported logs.
  - optional MAC/IP redaction mode.

### Component tests

- Main wizard screens render loading/success/error states.
- Matter-blocked state shows correct copy and prevents script upload.
- Safe relay test flow always ends OFF.
- Rule summary natural-language text matches selected thresholds.

### Integration/demo tests

- Demo mode can complete the full flow without hardware.
- Sample config generates valid script.
- App can build as web preview.

### Manual hardware tests

Keep hardware test checklists in `docs/testing/`.

Minimum MVP checklist:

```text
[ ] Xiaomi BTHome v2 detected in app
[ ] TP357 detected in app
[ ] Shelly Plug S Gen3 detected by IP/manual entry
[ ] Matter ON is detected and blocks install
[ ] Matter OFF + Scripts enabled allows install
[ ] Script upload succeeds
[ ] Script starts on boot
[ ] First sensor reading is shown
[ ] Relay safe test ON then OFF succeeds
[ ] Heating threshold ON works
[ ] Heating threshold OFF works
[ ] Stale sensor timeout turns relay OFF
[ ] Power cycle starts safe OFF
[ ] Diagnostics export contains no secrets
```

---

## 16. Required commands

Use `pnpm`. Do not introduce npm/yarn lockfiles.

Expected commands to create in root `package.json`:

```json
{
  "scripts": {
    "dev": "pnpm --filter @lcl/mobile dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:watch": "pnpm -r test -- --watch",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "precommit": "lint-staged && pnpm quality:ux",
    "prepush": "pnpm check",
    "prepare": "husky",
    "quality:ux": "node scripts/quality/ux-gate.mjs",
    "e2e:responsive": "playwright test -c apps/mobile/playwright.config.ts",
    "tokens:build": "pnpm --filter @lcl/design-tokens build",
    "check": "pnpm format:check && pnpm lint && pnpm quality:ux && pnpm typecheck && pnpm test && pnpm build",
    "check:full": "pnpm check && pnpm e2e:responsive"
  }
}
```

Before finishing a coding task, run the narrowest relevant checks. Before declaring a task done, run at least:

```text
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm typecheck
pnpm test
pnpm e2e:responsive
```

Run `pnpm build` when public APIs, package boundaries, generated output, routing, or app setup changed.

If a command cannot run in the environment, report exactly why and what was already verified.

---

## 17. Documentation policy

Documentation is part of the implementation.

Update docs in the same change when behavior changes.

Required docs:

```text
README.md
  - quick start
  - project commands
  - demo mode
  - architecture summary

docs/architecture/overview.md
  - package boundaries
  - data flow
  - why phone is not runtime controller

docs/compatibility/sensors.md
  - Xiaomi BTHome v2
  - TP357
  - unsupported sensors

docs/compatibility/outputs.md
  - Shelly Plug S Gen3
  - Matter/Scripts limitation

docs/testing/hardware-matrix.md
  - manual hardware checklist

docs/troubleshooting/mvp.md
  - no BLE sensor
  - Shelly offline
  - Matter blocks scripts
  - script upload failed
  - relay test failed
  - stale sensor

docs/adr/
  - one ADR per major technology/architecture decision
```

When adding a new package, include a package-level README explaining:

- purpose,
- public API,
- examples,
- tests,
- what must not be imported there.

---

## 18. ADR rules

Use ADRs for decisions that affect architecture, dependencies, runtime behavior, safety, privacy, or business model.

ADR template:

```md
# ADR-000X — Title

## Status

Accepted | Proposed | Superseded

## Context

What problem are we solving?

## Decision

What did we choose?

## Consequences

What improves? What tradeoffs or risks remain?

## Alternatives considered

What was rejected and why?
```

Required early ADRs:

```text
ADR-0001 — Ionic React + Capacitor + TypeScript
ADR-0002 — Phone is configurator, Shelly is runtime controller
ADR-0003 — Shelly-first MVP before Tasmota/NOUS
ADR-0004 — Design tokens from day one
ADR-0005 — No cloud/MQTT/Home Assistant in default MVP flow
```

---

## 19. Security and privacy rules

This project controls 230 V devices and scans local networks/BLE. Be conservative.

Rules:

- Default fail-safe for heating is OFF.
- Boot state is OFF.
- Stale sensor state is OFF.
- Max continuous ON time is enabled for heating profiles.
- Never store Wi-Fi passwords unless a future approved flow explicitly requires it.
- Never log secrets.
- Redact tokens, credentials, and auth headers.
- Diagnostics export must clearly show what it contains before sharing.
- Network scan must be user-initiated and limited to local network discovery.
- No cloud telemetry by default.
- Any optional telemetry/crash reporting requires explicit product decision and opt-in UX.
- Do not add analytics SDKs in MVP unless explicitly approved.

Forbidden:

- Sending BLE payloads, local IPs, MACs, or diagnostic bundles to third-party services by default.
- Fetching remote scripts for Shelly at runtime.
- Running destructive commands in developer scripts without clear confirmation.
- Weakening Android/iOS permissions to bypass platform rules.

---

## 20. Licensing rules

Before adding dependencies or copying code:

- Check license.
- Prefer MIT, BSD, Apache-2.0.
- Be careful with GPL/AGPL dependencies in app runtime.
- Do not copy code from Shelly examples, PVVX, Tasmota, or random GitHub repos without checking license and preserving notices.
- Reference upstream behavior in docs when useful, but write our own implementation unless license and attribution are clear.
- Keep `legal/THIRD_PARTY_NOTICES.md` updated.

Dependency rule:

```text
New production dependency requires explicit user approval.
New dev dependency is allowed only when it clearly improves tests, linting, docs, or build quality.
```

---

## 21. Error handling rules

Use typed app errors with user-safe messages.

Error categories:

```ts
export type ErrorKind =
  | 'permission-denied'
  | 'ble-unavailable'
  | 'sensor-unsupported'
  | 'sensor-stale'
  | 'shelly-offline'
  | 'shelly-unsupported'
  | 'matter-enabled'
  | 'script-upload-failed'
  | 'relay-test-failed'
  | 'validation-failed'
  | 'timeout'
  | 'unknown';
```

Rules:

- Technical error details go to diagnostics, not main UX.
- User-facing errors must include a next action.
- Never swallow errors silently.
- Never show raw stack traces in user-facing UI.
- Tests must cover expected failure modes.

---

## 22. Diagnostics rules

Diagnostics are a first-class feature, not an afterthought.

Minimum diagnostic fields:

```text
app version
platform
BLE permission status
sensor profile
last sensor reading
last RSSI
last seen time
Shelly IP/model/firmware
Matter status
Scripts status
script version/hash
script running status
relay state
last relay decision reason
last error kind
```

Rules:

- Add structured logs for setup flows.
- Keep logs bounded in memory.
- Redact sensitive fields before export.
- Include copyable support summary.
- Do not rely on console logs as the only diagnostic path.

---

## 23. Mock and demo mode

MVP must work without hardware in demo mode.

Demo mode requirements:

- Simulated Xiaomi BTHome sensor.
- Simulated TP357 sensor.
- Simulated Shelly Plug S Gen3.
- Simulated Matter ON blocked state.
- Simulated script upload success/failure.
- Simulated relay test.
- Simulated stale sensor.

Rules:

- Demo mode uses the same UI and domain logic as real mode.
- Demo adapters implement the same interfaces as real adapters.
- Do not hardcode demo behavior inside production components.

---

## 24. Performance rules

- Stop BLE scans when not needed.
- Debounce scan-result rendering.
- Avoid polling Shelly faster than needed.
- Use explicit timeouts for RPC.
- Avoid unbounded arrays of logs or scan results.
- Avoid expensive parsing in React render.
- Keep generated Shelly Script minimal.

---

## 25. Accessibility rules

- All interactive elements must have accessible labels.
- Do not use color alone to communicate status.
- Status badges need text.
- Buttons must have clear verbs.
- Error messages must be readable and actionable.
- Critical safety warnings must not be hidden behind icons only.

---

## 26. Anti-patterns to reject

Reject or refactor these patterns:

- Background phone automation loop.
- Cloud-first architecture.
- Home Assistant/MQTT required in default setup.
- Business logic inside React components.
- Direct Capacitor BLE calls from screens.
- Direct Shelly RPC calls from screens.
- `any`-heavy parser code.
- Hardcoded colors/spacing instead of tokens.
- Non-token breakpoint values or fixed two-column layouts that create horizontal overflow.
- Short-lived success/error/loading messages rendered inside cards or button rows so controls jump around.
- Primary modal/page actions rendered in the content area when they can live in the footer/header; this wastes space, pushes results down, and leaves awkward empty areas.
- Standalone action buttons left-aligned in otherwise right-aligned or
  full-width action patterns, for example a lone `Odśwież diagnostykę` button
  sitting on the left side of a panel.
- Small diagnostic payloads expanded into oversized cards, repeated tiles, or modal sections that waste vertical space; compact rows are required for a handful of parameters.
- Filler subtitles, duplicated descriptions, or obvious explanations added just to occupy space.
- Badges such as `dodane`, `wybrane`, `wspierane`, `manual`, or `brak` when the state is already obvious from context or does not change the next user action.
- Large permanent notice boxes for secondary help. Use an info tooltip or a short inline hint unless the message is blocking or safety-critical.
- Page layouts where forms, results, and actions are stacked in a way that leaves large blank regions or pushes the important data below the fold.
- Repeating the same IP/MAC/name in multiple visual blocks on the same screen without a clear reason.
- One-note color palettes, decorative tinted panels, or visual emphasis that competes with readings, device addresses, relay state, or primary actions.
- Unvalidated JSON from devices.
- Unbounded BLE scan subscriptions.
- Generated script assembled with unsafe string concatenation.
- Relay default ON.
- No backup before replacing Shelly script.
- Silent error handling.
- Copying third-party code without license review.
- Adding broad dependencies for small utilities.
- Implementing Tasmota/NOUS before Shelly-first MVP works.
- Expanding compatibility before Xiaomi + TP357 + Shelly flow is stable.
- Rewriting the whole app when a small module change is enough.

---

## 27. Working method for Codex

For every task:

1. Read this `AGENTS.md`.
2. Read `plan.md` if present.
3. Identify the smallest vertical slice that satisfies the request.
4. For changes touching more than one package, produce a short plan first.
5. Implement in small, reviewable steps.
6. Add or update tests.
7. Update docs when behavior changes.
8. Run relevant checks.
9. Summarize changed files, tests run, and any known limitations.

Before changing architecture or stack:

- Add or update an ADR.
- Explain alternatives.
- Get explicit approval.

When blocked:

- Do not invent missing hardware behavior.
- Add a mock interface and document the assumption.
- Mark hardware-dependent behavior as requiring manual validation.

---

## 28. Definition of done

A task is done only when:

- Code is typed and lint-clean.
- Tests cover new domain logic, parsers, generator output, or error states.
- UI has loading/success/error states where relevant.
- Safety behavior is not weakened.
- Docs are updated if user-facing or architectural behavior changed.
- Diagnostics still redact sensitive data.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass, or failures are explicitly explained.
- The final response states exactly what changed and what was not verified.

---

## 29. First implementation target

The first usable skeleton should implement this vertical slice:

```text
Demo mode:
  fake Xiaomi BTHome reading
  fake Shelly Plug S Gen3
  heating rule wizard
  generated Shelly Script preview
  fake upload and relay test
  diagnostics panel

Real adapters scaffolded:
  BLE scanner interface + Capacitor adapter shell
  BTHome parser fixtures
  TP357 parser fixture from the MatrixHub manufacturer-data model
  Shelly RPC client interface + fetch implementation
  script upload flow methods
```

Do not wait for all hardware integration to create the skeleton. Build the interfaces and demo path first, then attach real adapters.
