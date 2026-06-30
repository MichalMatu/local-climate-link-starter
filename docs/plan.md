# Local Climate Link — current MVP plan

Status: MVP `1.0.0` test candidate plan for this repository.

This file describes the current direction. Detailed contracts live in
`AGENTS.md`, vertical-slice history in `docs/implementation/vertical-slices.md`,
and architectural decisions in `docs/adr/`.

## Product promise

```text
Termostat bez huba.
Termometr BLE + gniazdko Shelly.
Konfigurujesz raz w aplikacji, działa lokalnie.
```

The app configures the system once. Runtime automation belongs on the Shelly
device, not on the phone, cloud, MQTT broker, Home Assistant, or a local server.

## Current MVP boundary

Supported path:

```text
Xiaomi LYWSD03MMC / PVVX / unencrypted BTHome v2
or TP357 custom BLE beacon
        ↓
Ionic React + Capacitor app
        ↓
Shelly Plug S Gen3 on stock firmware
        ↓
generated local Shelly Script
        ↓
Switch.Set relay control
```

Rule presets exist for temperature and humidity control: heating, cooling,
humidifying, and dehumidifying. Hardware validation still prioritizes the
Shelly-first heating path.

Out of scope for MVP:

- phone background automation,
- cloud or telemetry by default,
- Home Assistant or MQTT as a requirement,
- Tasmota/NOUS before the Shelly path is stable,
- flashing Shelly firmware,
- user-facing JavaScript editing,
- broad random-device compatibility.

## Current implementation

Already present in the codebase:

- pnpm workspace with TypeScript, ESLint, Prettier, Vitest, Playwright, and
  design-token checks,
- package split for BLE, profiles, automation core, Shelly client, script
  generation, diagnostics, UI, and design tokens,
- web/mobile setup UI with Shelly, thermometer, rule, and diagnostics pages,
- demo path with fake BLE and fake Shelly adapters,
- BTHome v2 and TP357 parsers with fixtures,
- deterministic automation core with safety guards,
- Shelly RPC client, script install service, fake transport, and safe relay
  test path,
- throttled Shelly mutating RPC calls for scripts and relay changes, plus
  best-effort cleanup for temporary BLE helper scripts,
- minimal generated Shelly runtime scripts with profile-specific parser paths,
  config hash, compact diagnostics, Shelly clock, plug telemetry, stale OFF,
  boot OFF, BLE start retry after reboot, min-change guard, and max-ON guard,
- temporary Shelly-side BLE discovery script named
  `Local Climate Link BLE Discovery`,
- diagnostics view that reads compact `/script/<id>/diag` metadata from the
  installed script, including read-only Shelly clock status, script hash/running
  state, plug telemetry, and readable decision reasons.

The current MVP path is ready for user hardware testing. The latest dated
Shelly Plug S Gen3 audit and full runtime matrix are recorded in
`docs/testing/hardware-matrix.md`. This does not expand the support promise
beyond the documented Xiaomi/PVVX BTHome v2, TP357, and Shelly Plug S Gen3 path.

## Runtime architecture

```text
Phone setup scan
        ↓
Shelly-side BLE confirmation
        ↓
typed JSON config
        ↓
deterministic Shelly Script
        ↓
local BLE scan + relay decisions on Shelly
```

Phone BLE scanning is setup UX only. On iOS, phone scan IDs must be treated as
unstable until the Shelly-side scanner confirms the runtime address.

Generated scripts must stay small. Upload chunking does not solve Shelly runtime
memory limits, so script-size budgets stay enforced by tests.

## Safety rules

Default safety behavior:

```text
boot/start      -> relay OFF
stale sensor    -> relay OFF
max ON exceeded -> relay OFF
scan failure    -> relay OFF
manual recovery -> OFF first, then normal auto evaluation
```

The app must never leave a relay test ON after failure. The user has granted
standing authorization for local development smoke tests to toggle the Shelly
relay without separate approval each time. Local Climate Link development
scripts on local hardware are disposable when the user explicitly authorizes
hardware actions.

## Active priorities

1. Run user-facing hardware tests on the documented MVP path.
2. Repeat the full Shelly hardware path after runtime or firmware changes.
3. Keep generated scripts minimal and profile-specific.
4. Keep diagnostics compact, readable, and useful for support.
5. Keep reducing UI noise only where it improves setup speed or safety.
6. Avoid adding new device families until Xiaomi/PVVX, TP357, and Shelly are
   stable end to end.

## Known validation gaps

- Xiaomi/PVVX and TP357 need repeated dated checks on real Shelly hardware.
- Stale-sensor and max-ON behavior need hardware confirmation after the latest
  runtime changes.
- iOS BLE identity behavior must remain documented as setup-only.
- Native mobile permission behavior needs device testing beyond the web preview.

## Checks

Use narrow checks while iterating. Before shipping meaningful code changes, run:

```text
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm e2e:responsive` when layout, routing, or browser-visible UI changed.
