# Local Climate Link — next functional steps

Updated: 2026-09-21
Status: stabilization first

## Current checkpoint

The latest accepted product/code baseline before stabilization documentation is:

```text
ef6ebd56ea3e92122845a31b5b1d70c7a518f397
Finalize Slice 3C integration handoff
```

The next work is **not** another feature slice. The active phase is stabilization of the existing Plug/automation lifecycle after user-visible regressions were observed on the real Android build.

Use `docs/HANDOFF_NEXT_CHAT.md` and `docs/implementation/stabilization-baseline-plan.md` as the active continuation sources.

## Why feature expansion is paused

The user observed on the Samsung S22+:

- one physical Shelly rendered as two cards, one with automation and one without;
- Plug add/remove behavior was unreliable;
- LAN scan found the Shelly, but Add did not successfully finish after clearing cache.

These are core lifecycle defects. Adding a BLE control/provisioning layer now would add another large state/transport surface before the LAN baseline is trustworthy.

Therefore:

```text
stabilize current LAN product
-> prove native + real-hardware lifecycle
-> freeze a green baseline
-> only then resume BLE feasibility/transport work
```

## Stable product model to preserve

- bottom navigation: **Plugs | Thermometers | Settings**;
- a physical Plug is the automation anchor;
- one physical Plug has one stable Shelly `deviceId` identity;
- IP / `baseUrl` is reachability, not identity;
- a plain Plug remains manageable without automation;
- a Plug may own one managed relay automation;
- Time is a Plug automation type;
- Climate and Time automations are editable in place;
- `InstalledAutomation` is durable automation ownership;
- Forget Plug does not uninstall the remote automation;
- the phone configures/manages/diagnoses;
- Shelly executes installed automation locally without requiring the phone or Shelly Cloud;
- current production Shelly RPC transport is LAN/HTTP during stabilization.

## Active stabilization outcomes

Before any BLE feature work, establish all of the following:

1. **Identity coherence** — one physical Shelly equals one stable saved Plug and one dashboard entry.
2. **Add lifecycle** — scan/manual Add succeeds or returns a specific actionable error.
3. **Forget/re-add** — local Forget and later re-add of the same physical Plug work predictably.
4. **Automation recovery** — an existing managed Climate/Time automation re-associates with the re-added Plug instead of creating a duplicate identity.
5. **Automation editing** — existing Climate and Time edit flows still mutate the owned runtime safely and preserve durable identity.
6. **Current Plug settings** — LED, button mode and Cloud settings still work without cross-family mutation.
7. **Relay/runtime behavior** — plain Plug and automation manual controls retain identity checks and safe-OFF rules.
8. **Code quality** — stale URL-as-id fixtures/paths, duplicated ownership and broad error handling are removed or corrected where evidence requires it.
9. **Native evidence** — real Samsung S22+ plus real Plug S Gen3 completes fresh-data and retained-data lifecycle smoke.
10. **Green baseline** — final full repository check, responsive/native acceptance, exact-main CI and Sandbox Pack are green.

## Architecture discipline during stabilization

This is a correctness/quality pass, not a license for a broad rewrite.

Keep:

- feature/product logic out of raw HTTP/BLE/storage;
- Shelly protocol parsing in `@lcl/shelly-client`;
- stable physical identity separate from endpoint reachability;
- durable automation ownership in `features/automations`;
- Plug-facing product settings/identity behavior in `features/plugs`;
- `useHardwareSetupFlow` as a facade, not a subsystem owner;
- screens free of persistence and transport orchestration;
- current architecture and UX budgets unless a separately justified architectural change is required.

Do not retain obsolete compatibility paths solely because old development fixtures used them. Prefer one canonical state shape.

## Verification policy

For stabilization work:

1. reproduce and add failing regression coverage first;
2. make the smallest cohesive fix at the correct owner;
3. use focused tests while iterating;
4. run repository/UX gates when boundaries or UI are touched;
5. run exactly one accepted final `pnpm check` on the final product tree;
6. run real Android + Shelly lifecycle acceptance;
7. update canonical docs;
8. fast-forward `main` only from a clean reviewed branch;
9. require exact-main CI and Sandbox Pack green.

Do not treat “Clear cache” as proof that durable WebView/localStorage state is fresh. Test genuinely fresh app-data and retained-data cases separately.

## Deferred: Shelly BLE

BLE remains planned, but is explicitly after stabilization.

When the stable baseline is accepted, resume with a fresh bounded feasibility/protocol review before production transport work. Preserve the existing intended ownership:

```text
features
  -> @lcl/shelly-client
      -> ShellyRpcTransport
          -> HTTP/LAN adapter
          -> future BLE adapter
```

Reuse the existing neutral GATT boundary in `@lcl/ble-core`. Do not build a parallel Shelly product stack and do not assume HTTP/BLE parity without real-hardware evidence.

## Active docs

```text
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/stabilization-baseline-plan.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/feature-boundaries.md
docs/testing/hardware-matrix.md
```

Older implementation plans are historical context unless the active handoff explicitly points to them.
