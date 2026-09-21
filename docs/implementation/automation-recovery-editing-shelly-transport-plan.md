# Automation recovery, editing and Shelly transport plan — historical record

Updated: 2026-09-21
Status: historical / superseded as active plan

This file is a compact record of the completed recovery/editing/settings slices and the deferred BLE direction. It is **not** the active continuation plan.

For current work use:

```text
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/stabilization-baseline-plan.md
```

## Preserved architecture decisions

These decisions remain current unless explicitly changed:

- stable Shelly `deviceId` is physical Plug identity;
- IP / `baseUrl` is reachability only;
- physical Plug -> optional installed automation;
- `InstalledAutomation` is durable automation ownership;
- one Plug relay has at most one managed Local Climate Link automation owner;
- Forget Plug and Uninstall Automation are different operations;
- destructive automation changes verify ownership and preserve safe-OFF behavior;
- product/feature code does not own raw HTTP/BLE transport details;
- Shelly RPC parsing/protocol behavior belongs in `@lcl/shelly-client`;
- future transport selection belongs at platform/adapter boundaries;
- BLE must be an additional transport under the same product/client behavior, not a parallel product stack.

## Completed slice record

### Slice 0 — InstalledAutomation foundation

```text
60295d5769a798bd20bdf70869ae8e256491ed18
Move installed automation state to feature
```

Established feature-owned durable installed-automation state and compatibility shims without changing user behavior.

### Slice 1A — Forget Plug vs Uninstall Automation

```text
b0b80e37fde234f2c0e1cbe8375d9235e5d91379
Protect automation ownership when forgetting plug
```

Locked the invariant that Forget removes local saved Plug/transient state but does not uninstall the remote managed automation.

### Slice 1B — Re-add and reconcile

```text
7aba04414abda1d0eb269e67599b574a4658404e
Reconcile installed automation when re-adding plug
```

Moved saved Plug identity toward verified `Shelly.GetDeviceInfo.id`, kept endpoint reachability separate and added managed runtime reconciliation for re-add.

Important later stabilization note: real usage exposed a remaining legacy/persisted-state edge where URL-shaped saved Plug ids can coexist with stable-id automation ownership. The stabilization phase must fix that before BLE work continues.

### Slice 2A — Edit installed Climate automation

```text
05f7eb4b8c83c1583222f374c8f3ebabff7e7703
Edit installed climate automation in place
```

Added in-place Climate edit using the existing editor, with stable identity/ownership verification, safe relay OFF, managed-script verification and durable state persistence only after verified remote success.

### Slice 2B — Edit installed Time automation

```text
e1a4c63e32000a90c22bd02b6c01ae9b37bff536
Edit installed Time automation in place
```

Added in-place Time schedule edit, preserving schedule ids and durable automation identity, with verification/rollback/safe-OFF behavior owned by the Time runtime.

### Slice 3A — Plug S LED settings

```text
b0319dddd668c6474b7544c38018518027e3b5f1
Complete Plug S LED settings
```

Moved typed `PLUGS_UI` LED ownership to `@lcl/shelly-client` + `features/plugs`, added complete supported LED surface and verified reversible behavior on the real Plug S Gen3.

### Slice 3B — physical button input mode

Integrated head:

```text
0155d0508a05e4fea46bca89a83501a28ab8cc18
```

Added typed `momentary | detached` support with controls-only mutation and real-hardware reversible smoke while preserving LED config and relay OFF.

### Slice 3C — Shelly Cloud enable/disable

Accepted product head:

```text
47e047cc8b748725b952f14f04ad46c7f8f11023
```

Integration/docs head before stabilization preparation:

```text
ef6ebd56ea3e92122845a31b5b1d70c7a518f397
```

Added typed Cloud config/status support and a separate Plug Cloud settings surface. Real-hardware smoke deliberately kept Cloud disabled and verified idempotent `enable:false`, unchanged Cloud server, unchanged Plug UI config and relay OFF.

Main CI and Sandbox Pack were green for the integrated 3C tree.

## Slice 4A/4B — BLE direction, deferred

The planned direction remains:

```text
feature flows
    -> @lcl/shelly-client API
        -> ShellyRpcTransport

platform adapters
    -> HTTP/LAN transport
    -> future BLE transport
```

A preliminary 4A real-hardware/protocol investigation began, but it was deliberately paused when core existing-product regressions were observed on the Android app.

Useful retained constraints:

- `@lcl/ble-core` already has a neutral GATT abstraction; do not create a second BLE stack;
- `@lcl/shelly-client` remains the protocol owner;
- do not assume HTTP/BLE operation parity;
- secure provisioning / firmware-specific behavior must be proven against real hardware;
- no production BLE Shelly transport should be implemented until the LAN baseline is stabilized and a fresh bounded 4A review is completed.

## Why stabilization now precedes BLE

User-visible regressions were found in the existing product:

- one physical Plug can appear twice when saved Plug identity and automation identity diverge;
- add/remove/re-add behavior is not yet trustworthy in real Android use;
- LAN scan can discover the device while Add still fails later in the deeper setup/reconciliation path.

These issues affect the core identity/state model that any BLE transport would also depend on. Fixing them first reduces transport ambiguity and prevents BLE from masking or multiplying state defects.

## Verification history

Detailed per-slice focused test counts, Local Agent task ids, hardware-smoke evidence and CI run ids remain available in Git history and `docs/testing/hardware-matrix.md`.

Do not copy old verification assumptions forward blindly. The stabilization plan requires a fresh combined lifecycle acceptance across the current product.

## Current continuation

```text
Slices 0–3C: historical completed work
Stabilization baseline: ACTIVE
BLE feasibility/transport: DEFERRED until stabilization is green
```
