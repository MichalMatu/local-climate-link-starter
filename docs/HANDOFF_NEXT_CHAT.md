# Next chat handoff — Slice 3A complete, Slice 3B+ next

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Start here

Before any write, read in this order:

```text
AGENTS.md
nearest nested AGENTS.md for the touched area
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/automation-recovery-editing-shelly-transport-plan.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/feature-boundaries.md
fresh main
agent-control:.agent/status/daemon.json
```

Repository/runtime identity:

```text
repository: MichalMatu/local-climate-link-starter
default/product branch: main
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Always fetch fresh `main`. Do not resume a historical work branch unless this handoff explicitly says to do so.

## Product invariants

```text
physical Plug -> optional installed automation
bottom navigation: Plugs | Thermometers | Settings
phone: configure/manage/diagnose
Shelly: execute installed automation locally
```

Keep these invariants:

- a saved Plug remains useful without automation;
- `InstalledAutomation` is durable managed-automation ownership;
- one Plug relay has one managed automation owner at a time;
- Forget Plug is local-only and is not Uninstall Automation;
- explicit uninstall preserves managed-identity verification and safe OFF;
- stable Shelly `deviceId` is physical identity;
- IP / `baseUrl` is reachability only and must not become the ownership key;
- future BLE remains another transport under the same Shelly client/product behavior.

## Slice lifecycle

```text
fresh main + idle daemon
-> preimplementation ownership/identity/transport audit
-> smallest cohesive implementation
-> focused tests
-> quality:repo when boundaries are touched
-> exactly one final full pnpm check
-> hardware/native smoke only when acceptance requires it
-> postimplementation full-diff re-audit
-> update canonical docs + plan + handoff
-> commit/push
-> review pushed diff
-> fast-forward main
-> verify main
-> cleanup completed work branch
```

Do not raise architecture baselines to make a slice fit. New cohesive product modules belong under `apps/mobile/src/features/<feature>`; protocol/domain behavior stays in packages; screens do not own raw transport or persistence.

## Last completed product slice — Slice 3A

Slice 3A is complete and integrated-ready.

```text
product commit: b0319dddd668c6474b7544c38018518027e3b5f1
message: Complete Plug S LED settings
validated work branch: work/slice3a-complete-led-settings
accepted final full check: 20260921-slice3a-final-check-v2
real hardware smoke: 20260921-slice3a-hardware-smoke-v1
live typed-client read: 20260921-slice3a-live-client-read-v1
focused responsive LED E2E: 20260921-slice3a-real-night-window-e2e-v2
```

Implemented contract:

- `@lcl/shelly-client` owns the typed `PLUGS_UI` LED protocol for the supported Plug S Gen3 surface: `power | switch | off`, relay ON/OFF RGB + brightness, power brightness and night mode;
- `features/plugs` owns LED settings orchestration and presentation for a physical Plug, so the same settings work with or without an installed climate/Time automation;
- every LED settings read or write verifies the live physical `Shelly.GetDeviceInfo.id` against the saved stable `deviceId` before touching `PLUGS_UI`; `baseUrl` remains reachability only;
- writes are deep partial LED-only patches and never write the unrelated `controls` subtree;
- options are capability-driven from fields actually exposed by the device rather than scattered model-name checks;
- the legacy installation-owned `flows/installations/deviceLed.ts` and `screens/ShellyLedSettingsCard.tsx` paths were removed;
- the shared mobile `SelectField` is used for LED mode rather than a native select;
- current HTTP remains an adapter under the same Shelly client boundary; no speculative BLE behavior was added.

Real Plug S Gen3 finding carried forward:

```text
URL during Slice 3A smoke: http://192.168.0.10/
deviceId: shellyplugsg3-e4b063d7f530
model: S3PL-00112EU
gen: 3
firmware: 1.7.5
fw_id: 20260311-095902/1.7.5-g9979d16
```

Firmware `1.7.5` returns `leds.night_mode.active_between: []` while night mode is disabled. The typed client accepts that real shape. The editor presents bounded defaults `22:00–06:00`, changing only brightness keeps the outgoing patch brightness-only, and enabling night mode from an empty window writes an explicit valid time pair.

Verification:

- accepted final full `pnpm check` passed on the exact product tree in `20260921-slice3a-final-check-v2`, including format, lint, UX/repository/feature gates, all workspace typechecks/tests, core coverage and production builds;
- focused current client/form/component coverage passed (`7/7` `shelly-client` tests and `7/7` Plug LED feature tests before the final suite);
- `apps/mobile/e2e/led-settings.spec.ts` passed `9/9`, covering 360×800, 390×844, 412×915 and tablet layouts, presets, real empty night window handling, unsupported capability state, Time detail reuse and LED settings on a saved Plug with no installed automation;
- postimplementation full-diff audit found no dependency, lockfile or architecture-baseline changes and confirmed the squashed branch is one product commit ahead of the prior `main`;
- live typed-client read against the real Plug parsed the actual empty night window and derived exactly `{ night_mode: { brightness: 7 } }` for a brightness-only edit;
- reversible physical smoke changed only night brightness `100 -> 7`, confirmed readback, then restored the full original `PLUGS_UI` config exactly; relay was OFF before and after, and `Local Climate Link Thermostat` script id `1` remained enabled and running.

## Immediate next slice — Slice 3B+

**Add one additional Shelly device-settings family at a time from real supported capabilities.**

Start with a fresh capability/ownership audit. Keep the pattern established in 3A:

```text
features/plugs focused settings UI/flow
        -> @lcl/shelly-client typed config API
        -> ShellyRpcTransport
```

Do not create a generic settings manager or raw JSON editor. Do not mix multiple unrelated settings families into one slice. Confirm the selected family against current official Shelly documentation and real Plug S Gen3 hardware, preserve unknown/unrelated config with narrow writes, and keep stable `deviceId` verification before mutation. BLE remains deferred to Slice 4A+.

## What follows

```text
3B+ additional Shelly settings families
4A  real-hardware BLE feasibility/protocol spike
4B  BLE ShellyRpcTransport
4C+ incremental BLE-backed capabilities
```

Detailed acceptance criteria live in `docs/implementation/automation-recovery-editing-shelly-transport-plan.md`.

## Canonical docs

```text
AGENTS.md
apps/mobile/AGENTS.md
apps/mobile/src/features/AGENTS.md
packages/AGENTS.md
packages/ui/AGENTS.md
scripts/quality/AGENTS.md
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/automation-recovery-editing-shelly-transport-plan.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/feature-boundaries.md
scripts/quality/architecture-baseline.mjs
```

Historical plans are reference only. Current code + canonical docs + the active execution plan win on conflict.
