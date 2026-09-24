# Handoff — UX closeout accepted, Shelly-over-BLE next

Status: **2026-09-25**

Repository: `MichalMatu/shelly-link`

Canonical restart point: **fresh `main`**. The broad UX stabilization pass and the follow-up screenshot-driven closeout are accepted on the real Samsung S22+. Do not reopen a broad redesign without a new concrete defect. The next active product task is the narrow Shelly-management-over-BLE hardware spike.

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Stable product baseline

- Shelly physical identity is canonical; URL/IP is transport only.
- A saved Plug remains useful without automation.
- Climate and Time use one installed-automation ownership model.
- Climate supports 1–4 thermometers with `avg`, `min`, `max` or `firstValid` aggregation.
- Climate install/edit/repair uses exclusive Shelly Script ownership: verify physical Plug identity, confirm or force relay OFF, delete every existing Shelly Script, then create/start a fresh managed runtime.
- Passive recovery does not rewrite a valid managed runtime.
- Shelly executes installed automation locally without phone/cloud dependency after configuration.
- TP357/TP357S battery decoding uses the validated low-two-bit state mapping `0 -> 1%`, `1 -> 50%`, `2 -> 100%`, `3 -> unknown`.
- Soil-moisture support is deferred and is not on the active near-term path.

## Accepted UX baseline — CLOSED

Plug detail remains one surface with five local tabs:

```text
Automation | BLE | Device | Script | Info
```

Established rules:

- Automation owns live rule/relay state and inline Climate editing; there is no nested Edit page.
- BLE owns Bluetooth state, configured sensor readings/diagnostics and scan controls.
- Device owns LED, physical button mode and Shelly Cloud.
- Script is code-focused; runtime/resource diagnostics live in Info.
- Info uses matching inline-framed `Shelly` and `Diagnostics` groups.
- Tab surfaces are flat by default; framed groups are used only for closed data/control groups; `Disclosure` is reserved for optional expandable content.
- Device forms protect dirty local drafts from background refetches.
- LED presets are 4×2 on phone widths and 8×1 on wider layouts.
- Standalone Add Plug/Thermometer pages intentionally have no page-local Back control.
- The accepted Climate dashboard card keeps its compact threshold/VPD presentation and must not be broadened without explicit product intent.

### Targeted screenshot-driven closeout — DONE

The real-phone screenshot pass is accepted and closed. It fixed concrete inconsistencies without changing the accepted information architecture:

- inline framed LED legends (`ON`, `OFF`, `Night mode`) now use the same background-mask and tight line-height treatment as equivalent framed titles in Info;
- the redundant `CHECK` / `COMPATIBLE` badge was removed from the Model row because compatibility is already enforced during Plug onboarding and that badge mixed model identity with transient capability state;
- the false `Script — missing in status` diagnostic was removed at its source: `Shelly.GetStatus` is no longer treated as exposing a synthetic global `status.script`; script-management availability comes from `Script.List`, and concrete runtime state comes from `Script.GetStatus`;
- redundant script-state rows were collapsed to the single authoritative `RPC script state` row;
- E2E fixtures now use dynamic Shelly script keys such as `script:1`, and intentional screenshot deltas were promoted to the canonical visual baselines.

Implementation acceptance commit:

```text
4383182be09a8e8c6ffecd1c1effed0fd837216e  Fix Shelly script status semantics
```

That commit passed the full pre-push gate (`pnpm check` plus canonical visual E2E), was built and installed on Samsung SM-S906B / Android 16 with `adb install -r` preserving app data, and the user accepted the resulting Info/Device presentation as correct.

The UX track is closed again. Reopen it only for a new concrete defect or an explicitly requested product change.

## Development direction — DECIDED

The active product direction is now:

1. **Shelly management / relay control over BLE — NEXT.** Reuse the existing `ShellyRpcTransport` ownership boundary. BLE is a transport adapter, not a second product model.
2. **Curated Shelly Script Library with simple configurators.** Use verified official/approved scripts and expose a simple `choose -> configure -> install/run` flow. Reuse the same identity, transport, safety and ownership rules.
3. **History / datalogger redesign and port.** Preserve `work/kvs-datalogger` as source material, but do not rebase-and-merge it mechanically because its two-script design predates current exclusive Shelly Scripts ownership.
4. Richer timing/operators and advanced automation UX remain later work unless a concrete product need moves them forward.

## Immediate next slice — Shelly RPC over BLE

Keep the first slice deliberately narrow and hardware-first.

### Architecture ownership

```text
product owner      -> Plug management
state owner        -> existing Plug / installed-automation state
side-effect owner  -> @lcl/shelly-client transport adapter
UI owner           -> none required for the first feasibility spike
final file layout  -> BLE ShellyRpcTransport adapter beside the existing HTTP transport
                      plus the smallest mobile/platform binding needed to open BLE
                      without moving product logic into a screen
test owner         -> shelly-client transport tests + focused mobile adapter tests
                      + real Plug S Gen3 acceptance
```

### First acceptance slice

1. inspect the existing HTTP `ShellyRpcTransport` boundary and define the smallest BLE adapter contract without duplicating product logic;
2. on the known development Plug S Gen3, establish the required BLE connection/bonding path and verify physical identity with `Shelly.GetDeviceInfo`;
3. prove the read-only status RPCs needed for management;
4. prove safe relay control with `OFF -> ON -> OFF`, explicitly verify the final relay state is **OFF**, and record framing/payload-size/retry/timeout/connection-lifecycle constraints;
5. do **not** port the exclusive script lifecycle in the first spike unless the identity/status/relay path is already reliable and reviewable.

The HTTP transport remains the baseline and must not regress while BLE support is added. Do not create a second automation ownership or persistence model for BLE.

## Datalogger branch — PARKED SOURCE MATERIAL

`work/kvs-datalogger` is intentionally retained but is **not merge-ready**.

When this track resumes:

- do not merge it into `main` as-is;
- do not treat a rebase alone as sufficient;
- first reconcile its old second-script History Tail design with current exclusive script ownership;
- port only still-valid history/KVS/codec/client/generator pieces;
- re-establish KVS capacity, lifecycle, memory and real Plug S Gen3 hardware acceptance;
- Climate safety/relay behavior must remain independent of History failure.

See the parked branch's `docs/KVS_DATALOGGER_IMPLEMENTATION.md` when this track is resumed.

## Branch state

Expected long-lived/intentional branches:

- `main` — canonical product source of truth;
- `agent-control` — Local Agent infrastructure only;
- `work/kvs-datalogger` — intentionally parked source material for a future redesigned history track.

Completed UX, TP357 and placeholder work branches are retired and must not be recreated.

## Restart checklist

At the beginning of the next development session:

```text
read AGENTS.md
read docs/HANDOFF_NEXT_CHAT.md
read docs/ARCHITECTURE.md
read docs/ROADMAP.md
fetch fresh main
check agent-control daemon
confirm no duplicate Local Agent task
start only the Shelly-over-BLE spike unless the user changes priority
```

For the immediate next session, start from fresh `main` and the narrow Shelly-over-BLE hardware spike above. Do not reopen UX, soil moisture or the parked datalogger track unless the user explicitly changes priority.
