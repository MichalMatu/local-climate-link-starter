# Architecture overview

Local Climate Link is a phone configurator and management UI for automations that execute locally on Shelly hardware. The phone is required for setup/management, not for normal runtime control.

## Durable product model

The current app has three independent registries:

- **Plugs** — physical Shelly identity plus mutable endpoint and user name.
- **Thermometers** — physical/runtime BLE sensor identity plus user name.
- **Rules** — desired automation configuration plus deployment metadata and exact runtime ownership.

A thermometer is never owned by a plug. A climate rule is the only durable relationship between a sensor and a plug. Device names and rule names are independent. Exactly one rule can own a `(plugId, relayId)` pair.

Current storage keys are `lcl.plugs.v1`, `lcl.sensors.v1`, and `lcl.rules.v1`. The removed installation/setup-draft persistence model must not be recreated with compatibility readers, migrations, dual writes or adapters.

## Runtime split

### Climate rules

The generated Shelly script is a long-lived local runtime. It receives BLE advertisements, parses the configured sensor, applies threshold/VPD/failsafe logic, exposes diagnostics and controls the relay locally.

AUTO/MANUAL is the runtime's in-process `R.m` state. MANUAL keeps BLE and diagnostics alive while blocking automatic output. Unknown/unreadable mode fails closed. Normal mode switching never uses `Script.Stop`/`Script.Start`.

Temporary Shelly-side BLE discovery keeps the climate runtime alive in verified MANUAL/OFF, uses a separate discovery script/scanner session, cleans that session up, then restores the exact prior mode. If the prior mode cannot be read or restored, fail closed.

### Time rules

Pure time rules use Shelly native Schedule jobs. Exact job ids are stored in rule deployment metadata. Climate active-hour constraints are separate and remain inside the climate runtime.

## App boundaries

- `flows/devices/plugs` — plug persistence, registration and guarded direct operations.
- `flows/devices/sensors` — thermometer persistence and live sensor management.
- `flows/rules` — rule model/editor/lifecycle/runtime ownership/deployment.
- `flows/registry/devicesAndRules.ts` — composed independent registries.
- `flows/runtime` — shared runtime protocols and relay-safety primitives.
- `flows/hardware-setup` — narrow discovery/diagnostic/validation helpers only; no durable setup store.
- screens — route-level composition and presentation, not persistence/RPC/deployment algorithms.

Package-level BLE parsing, device profiles, Shelly RPC, script generation, automation logic, diagnostics, design tokens and reusable UI remain in their dedicated packages.

## Safety boundary

Every runtime mutation must verify the current physical identity and exact owner. Destructive/recovery operations use OFF-first cleanup. Failed or unreadable inventory/mode state is never treated as permission to control the relay.

See `docs/architecture/refactor-boundaries.md` for code boundaries and `docs/architecture/runtime-control.md` for the climate mode/discovery protocol.
