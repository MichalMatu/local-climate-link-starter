# Automation recovery, editing and Shelly transport execution plan

Updated: 2026-09-20
Status: active execution plan

This is the canonical execution sequence after the Phase 0–3 architecture/tooling closeout. Work in small mergeable slices. Do not start the next slice while the previous one is red, unreviewed or only present on a work branch.

## Runtime identity

```text
repository: MichalMatu/local-climate-link-starter
default/product branch: main
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Every Local Agent task must use that exact binding.

## Product direction

The connected goals are:

1. forgetting and later re-adding the same physical Shelly must recover its existing managed automation;
2. installed climate and Time automations must be editable in place;
3. Plug management should expand toward fuller Shelly configuration support, beginning with complete LED settings;
4. Shelly BLE should become an additional communication channel without duplicating product or RPC logic.

Target dependency shape:

```text
stable physical Shelly identity
          |
          v
        Plug
          |
          +---- InstalledAutomation
          |
          +---- device settings
          |
          v
     Shelly client APIs
          |
          v
   ShellyRpcTransport
       /        \
 HTTP / LAN     BLE
```

`deviceId` is physical identity. IP / `baseUrl` is HTTP reachability, not identity.

## Cross-cutting rules

- Feature/product logic must not call raw `fetch`, `CapacitorHttp` or future BLE GATT APIs.
- Shelly RPC shapes, parsing, validation and protocol behavior belong in `@lcl/shelly-client`.
- Browser/native/BLE transport construction and selection belong at platform/adapter boundaries.
- Feature flows own product orchestration through narrow Shelly client/transport contracts.
- Durable automation ownership is keyed by stable Shelly identity plus relay ownership, never by IP alone.
- Forget Plug and Uninstall Automation are different operations.
- Never adopt or mutate an arbitrary Shelly script/schedule because it looks similar; managed identity must be verified.
- One relay has one managed automation owner at a time.
- Destructive automation changes preserve safe-OFF and identity verification.
- Do not add speculative abstractions only for future BLE when the current transport boundary already works.
- Production TS/TSX architecture budgets remain authoritative; do not raise them to land a slice.

## Standard slice lifecycle

Every slice follows this order:

```text
fresh main + daemon
-> read root + nearest AGENTS.md + handoff + this plan
-> reproduce/audit current behavior
-> preimplementation ownership/identity/transport gate
-> smallest cohesive implementation
-> focused tests
-> quality:repo when architecture boundaries are touched
-> exactly one final full pnpm check
-> hardware/native smoke only when required by acceptance
-> mandatory postimplementation re-audit of complete diff
-> update canonical docs + this plan + handoff
-> commit/push
-> review pushed diff
-> fast-forward main
-> verify main
```

Before coding, explicitly identify:

```text
product owner
state owner
side-effect owner
UI owner
final file layout
test owner
stable identity
durable state vs derived/reconciled state
remote state that must be verified before mutation
```

The postimplementation re-audit must confirm that state, lifecycle and side effects still have one owner; screens/facades did not absorb transport/persistence/domain logic; HTTP endpoint data did not become identity; no BLE-future logic was duplicated; architecture alarms did not grow without justification; failure/conflict/offline states are covered; and canonical docs still match reality.

## Slice 0 — InstalledAutomation feature foundation

Status: **done**.

Completed product commit:

```text
60295d5769a798bd20bdf70869ae8e256491ed18
Move installed automation state to feature
```

Result:

- `features/automations` owns durable installed-automation model, repository and Zustand state;
- Time config used by durable automation state is feature-owned;
- legacy installation model/repository/store and time-config paths are thin public-API compatibility shims;
- no user-visible behavior changed.

Verification before integration:

- 8 focused mobile test files / 94 tests passed;
- `pnpm quality:repo` passed;
- exactly one final full `pnpm check` passed, including build;
- postimplementation ownership/public-API re-audit passed;
- no physical-device test was required.

Known limitation carried forward: the Forget Plug / re-add recovery regression is intentionally not solved by Slice 0.

## Slice 1A — separate Forget Plug from Uninstall Automation

Status: **done**.

Completed product commit:

```text
b0b80e37fde234f2c0e1cbe8375d9235e5d91379
Protect automation ownership when forgetting plug
```

Audit result: the production Forget Plug path already had the required semantics. `removeShellyDevice` removes only the saved Plug entry plus transient setup/control state. It does not call `removeInstallation` and does not mutate Shelly runtime. Destructive remote automation removal remains owned by the explicit climate/Time uninstall detail flows.

Slice 1A therefore added a regression test rather than unnecessary product logic. The acceptance test now creates a durable `InstalledAutomation`, forgets the saved Plug through the real confirmation UI, and proves the durable automation record remains unchanged.

Verification before integration:

- focused `hardware-setup.test.tsx` passed;
- `pnpm quality:repo` passed;
- exactly one final full `pnpm check` passed;
- postimplementation diff audit confirmed the slice changes only the regression test;
- no physical-device test was required because no runtime behavior changed.

The user-visible recovery defect therefore belongs to Slice 1B: saved Plug identity/re-association and remote-runtime reconciliation after re-add.

## Slice 1B — re-add and reconcile existing managed automation

Status: **done**.

Completed product commit:

```text
7aba04414abda1d0eb269e67599b574a4658404e
Reconcile installed automation when re-adding plug
```

Result:

- verified `Shelly.GetDeviceInfo.id` is now the saved Plug identity; `baseUrl` remains reachability only;
- stable Shelly identity normalization lives in `@lcl/shelly-client`, while Plug-facing identity comparison is exposed by `features/plugs`;
- `features/automations` owns reconciliation of durable `InstalledAutomation` records with the verified physical Shelly;
- re-adding the same `deviceId` at a changed endpoint refreshes the durable automation endpoint/name/model metadata without changing automation identity or `installedAtMs`;
- climate reconciliation verifies the managed script id, running state and exact code hash;
- Time reconciliation reuses the existing exact schedule-pair verification contract;
- reconciliation reports `none`, `verified`, `changed`, `unavailable` or `conflict` and never adopts an unrelated runtime heuristically;
- dashboard, detail and scan saved-state association now use stable physical identity rather than URL matching.

Verification before integration:

- focused iterations covered reconciliation, hardware setup, dashboard/detail and routing regressions;
- final mobile typecheck passed;
- exactly one final full `pnpm check` on the accepted v6 implementation passed;
- postimplementation diff audit passed and architecture baselines were unchanged;
- no physical-device smoke was required because the regression is identity/re-association logic and the RPC behavior is covered by deterministic fixtures.

Known limitation carried forward: reconstruction after complete app-storage loss is still intentionally out of scope; recovery assumes Local Climate Link retains its durable `InstalledAutomation` record.

## Slice 2A — edit installed climate automation in place

Expected UX:

```text
Plug
-> installed climate automation
-> Edit
-> editor prefilled from InstalledAutomation config
-> Save
-> update/replace managed Shelly runtime
-> verify runtime
-> persist updated InstalledAutomation
```

Reuse the current editor and runtime pipeline. Preserve `installedAtMs`; update `updatedAtMs` only after verified success. Preserve automation identity when relay ownership is unchanged. Detect sensor/relay ownership conflicts before destructive mutation. Failed remote mutation must not leave local state claiming success.

## Slice 2B — edit installed Time automation in place

Use the same product-level edit/navigation semantics as 2A but keep Time's native Shelly schedule lifecycle separate. Update durable schedule IDs/config only after verified remote mutation. Do not force climate and Time runtimes through one artificial implementation.

## Slice 3A — device-settings foundation + complete LED settings

First inventory the LED configuration/capabilities actually exposed by supported physical Shelly hardware. Model typed protocol behavior in `@lcl/shelly-client`; do not copy another app's screen structure blindly.

Target ownership:

```text
features/plugs device settings UI/flow
        -> @lcl/shelly-client typed config API
        -> ShellyRpcTransport
```

Feature code sees typed settings/capabilities, not raw RPC payloads. Preserve unrelated config on partial updates. Capability differences are explicit rather than scattered model-name conditionals. Physical Shelly verification is required.

## Slice 3B+ — additional Shelly settings families

After LED, audit the supported device capability matrix and add one cohesive settings family per slice. Each family gets a typed `@lcl/shelly-client` owner, feature-owned presentation/orchestration, capability detection, focused tests and physical smoke. Do not create a generic settings God object or raw JSON editor.

## Slice 4A — BLE feasibility and protocol spike

Use real hardware to establish discovery/connection, GATT services/characteristics, authentication/pairing, request/response framing and fragmentation, limits, supported RPC/config operations, timeout/retry/disconnect behavior, Wi-Fi provisioning viability, and whether script/config operations needed by Local Climate Link are practical over BLE.

Record a capability matrix. Do not pretend HTTP and BLE are equivalent where hardware says otherwise. This is a bounded spike, not permission for speculative product refactors.

## Slice 4B — BLE ShellyRpcTransport

Implement BLE as another transport while keeping Shelly protocol/product logic shared:

```text
feature flows
    -> @lcl/shelly-client API
        -> ShellyRpcTransport

platform adapters
    -> HTTP transport/session
    -> BLE transport/session
```

Transport selection/fallback must be explicit and testable. Never silently switch transports mid-destructive mutation without preserving operation identity/failure semantics.

## Slice 4C+ — enable BLE-backed capabilities incrementally

Start with low-risk supported reads, then settings/relay mutations, then provisioning or automation-management operations only if the feasibility matrix proves them reliable. Existing LAN flow must remain valid without BLE.

## Recovery versus reconstruction policy

Solve recovery while Local Climate Link durable state still exists first. Reconstructing all managed state solely from a Shelly after app data loss is stronger behavior and should use an explicit device-resident management manifest/identity mechanism rather than heuristic adoption.

## Transport-neutral data policy

As touched slices require it, move toward conceptual separation:

```text
physical identity
  deviceId
  model/generation metadata

reachability
  last-known HTTP endpoint
  BLE address/session discovery data

managed product state
  InstalledAutomation
  settings cache only where justified
```

Do not perform a schema rewrite solely to match this diagram.

## Current progress

```text
0   InstalledAutomation foundation        DONE  60295d576
1A  Forget vs uninstall semantics         DONE  b0b80e37f
1B  Re-add + reconciliation               DONE  7aba04414
2A  Edit climate automation               NEXT
2B  Edit Time automation                  pending
3A  Full LED settings                     pending
3B+ Additional settings families          pending
4A  BLE feasibility spike                 pending
4B  BLE transport                         pending
4C+ BLE-backed capabilities               pending
```

## Handoff rule

At every completed slice, `docs/HANDOFF_NEXT_CHAT.md` must contain the completed product commit, verification performed, hardware evidence if applicable, unresolved limitations, exact next slice, work-branch disposition and Local Agent binding. A new chat must still fetch fresh `main`; a documentation-finalization commit necessarily comes after the product commit recorded for the slice.
