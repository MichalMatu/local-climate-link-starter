# Automation recovery, editing and Shelly transport execution plan

Updated: 2026-09-20
Status: active execution plan

This document is the canonical execution plan for the next Local Climate Link product work after the Phase 0–3 architecture/tooling closeout.

It converts the agreed product direction into small, mergeable slices. Do not turn it into a broad refactor program. Each slice must leave `main` green and improve the ownership boundaries needed by the next slice.

## Runtime identity

```text
repository: MichalMatu/local-climate-link-starter
default/product branch: main
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Every Local Agent task JSON must use exactly that `agent_binding`.

## Product direction

The work has four connected goals:

1. a Plug that is forgotten and later added again must recover its existing managed automation instead of appearing as a new Plug with no automation;
2. an installed automation must be editable in place rather than requiring delete + reinstall setup;
3. Plug management should expand toward substantially fuller Shelly configuration support, starting with complete LED settings;
4. Shelly BLE should become an additional communication channel without duplicating product logic or making feature code transport-specific.

The architectural shape we want to preserve is:

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

`deviceId` is device identity. An IP address / `baseUrl` is a reachable HTTP endpoint, not identity. New product code must not make device ownership depend on the current HTTP address.

## Cross-cutting rules

These rules apply from the first slice even before BLE exists:

- feature/product logic must not call raw `fetch`, `CapacitorHttp` or future BLE GATT APIs;
- Shelly RPC shapes, validation and device protocol behavior belong in `@lcl/shelly-client`;
- browser/native/BLE transport construction and selection belong at platform/adapter boundaries;
- feature flows orchestrate product behavior and consume narrow Shelly client/transport contracts;
- durable automation ownership is keyed by stable Shelly identity plus relay ownership, never by IP alone;
- forgetting a Plug and uninstalling a managed automation are different operations;
- never adopt or mutate an arbitrary existing Shelly script/schedule merely because it looks similar; managed identity must be verified;
- one relay has one managed automation owner at a time;
- destructive automation changes keep safe-OFF and identity verification guarantees;
- do not add speculative abstractions only for future BLE; preserve transport neutrality where the existing boundary already supports it;
- default production TypeScript/TSX ceiling remains 350 lines; no architecture baseline is raised merely to land a slice.

## Standard slice lifecycle

Every slice in this plan follows the same lifecycle.

### 1. Start from truth

Before any write:

1. fetch fresh `main`;
2. fetch `agent-control:.agent/status/daemon.json`;
3. verify the daemon repository/binding and that no duplicate task is running;
4. read root + nearest nested `AGENTS.md`;
5. read `docs/HANDOFF_NEXT_CHAT.md`, this plan and relevant canonical architecture docs;
6. reproduce the regression or establish the current behavior with a focused test/hardware observation.

### 2. Preimplementation architecture gate

Record explicitly:

```text
product owner
state owner
side-effect owner
UI owner
final file layout
test owner
```

Also answer before coding:

- what is the stable identity involved?
- what state is durable versus derived/reconciled?
- what remote state must be verified before mutation?
- is any HTTP-specific detail leaking above the transport boundary?
- does the target hotspot need a cohesive extraction before it gains another responsibility?

### 3. Implement the smallest cohesive behavior

- one work branch per mergeable slice;
- behavior change and the minimum required ownership cleanup stay in the same slice;
- no unrelated cleanup or broad folder migration;
- use Local Agent when local commands, full checks, native work or physical Shelly/BLE validation are required.

### 4. Verify

During iteration run focused tests only.

Before completion:

1. run the focused regression/feature tests;
2. run `pnpm quality:repo` whenever architecture boundaries are touched;
3. run exactly one final full `pnpm check`;
4. run emulator/physical Shelly smoke when device behavior is part of the acceptance surface;
5. leave relay state explicit and known after hardware testing.

A slice is not complete with a red full check. Fix the failure or report the exact blocker and do not advance the plan.

### 5. Postimplementation re-audit

Before committing, inspect the complete diff again and answer:

- is there still one owner for state, lifecycle and side effects?
- did a facade/screen gain transport, persistence or domain behavior?
- did HTTP endpoint data accidentally become device identity?
- did the change duplicate logic that a future BLE transport would also need?
- did any production module cross/grow an architecture alarm?
- can stale code made obsolete by this slice now be removed safely?
- are failure/conflict/offline states explicitly tested?
- did product behavior or ownership change enough to require canonical-doc updates?

This re-audit is mandatory even when all tests are green.

### 6. Documentation, commit and integration

After the re-audit and before declaring the slice done:

- update this plan's progress section;
- update canonical architecture/product docs when their truth changed;
- update `docs/HANDOFF_NEXT_CHAT.md` with the completed slice, exact resulting commit/branch state, verification performed, known limitations and the single next recommended slice;
- commit and push the cohesive slice;
- review the pushed diff;
- fast-forward `main` only from the reviewed green branch;
- verify `main` points at the expected commit;
- remove/clean the completed work branch when practical.

Do not begin the next slice while the previous slice exists only as unreviewed/unmerged work.

## Execution order

### Slice 0 — close the InstalledAutomation feature foundation

Goal: finish the already-attempted move of durable installed-automation model/repository/store ownership into `features/automations` before building new lifecycle behavior on top of it.

Current known state at plan creation:

- `main` is still at `0c52c75b23c591ad40b50902a3091942521a191f`;
- the previous Local Agent attempt `20260920-installed-automation-feature-foundation-v3` did not merge;
- focused tests and architecture gates passed;
- the final full check failed because `src/__tests__/script-preview.test.ts` could not resolve `createInstalledAutomation` after the public-API move;
- the work branch ended identical to `main`, so there is no partial product change to preserve.

Acceptance:

- `InstalledAutomation`, its repository/store and related config ownership live behind the `features/automations` public API as intended;
- legacy paths, if still required, are thin compatibility/import shims only and do not regain ownership;
- all callers including script-preview tests use the intentional public API;
- focused tests, `quality:repo` and the final `pnpm check` pass.

Do not change user-visible behavior in this slice.

### Slice 1A — separate Forget Plug from Uninstall Automation

Goal: fix the core semantic bug that currently allows forgetting/removing a saved Plug to make its still-installed automation disappear from the product model.

Required behavior:

- `Forget Plug` removes the saved management/discovery entry for the Plug;
- it does not silently uninstall the managed automation from Shelly;
- it does not destroy durable automation ownership merely because the Plug card was forgotten;
- the existing explicit automation uninstall/delete path remains responsible for verified remote removal and safe-OFF behavior.

Audit the current delete/forget path first. Do not assume whether the bug is in persistence, store composition or UI filtering until reproduced.

Acceptance test must cover at least:

```text
add Plug
-> install managed automation
-> forget Plug without uninstalling automation
-> automation ownership record remains durable
```

### Slice 1B — re-add and reconcile an existing managed automation

Goal: when the same physical Shelly is added again, reconnect it to the existing managed automation and verify that the remote runtime still matches what Local Climate Link owns.

Identity contract:

- match the physical Shelly by normalized stable `deviceId`;
- do not match ownership by IP / `baseUrl`;
- update the last-known HTTP endpoint independently when the same device is rediscovered at a different address.

Reconciliation should distinguish explicit states rather than flattening everything into "has automation" / "no automation". At minimum the implementation design must account for:

```text
local managed record + remote managed runtime verified
local managed record + remote runtime missing/changed
remote unreachable / verification unavailable
relay ownership conflict
no local managed record
```

For a local managed record, re-add should verify remote managed identity before presenting the automation as healthy. Do not silently claim an unrelated script/schedule.

If the audit proves that climate runtime can be reconstructed safely from verified Local Climate Link script identity/source, that can be added as a cohesive follow-up. Do not invent unsafe schedule adoption for Time automation merely to make recovery symmetrical.

Acceptance must include the real reported regression:

```text
Plug with installed automation
-> Forget Plug
-> add the same physical Plug again
-> existing automation is shown for that Plug
```

Also cover re-add with a changed IP/HTTP endpoint.

### Slice 2A — edit an installed climate automation in place

Goal: turn the existing climate rule editor into an edit flow for an already-installed automation instead of forcing delete/reinstall.

Expected UX:

```text
Plug
-> installed climate automation
-> Edit
-> editor prefilled from current InstalledAutomation config
-> Save
-> update/replace managed Shelly runtime
-> verify runtime
-> persist updated InstalledAutomation
-> remain in the Plug/automation management flow
```

Requirements:

- reuse the existing automation editor and runtime install/update pipeline rather than creating a second "edit installer";
- keep `installedAtMs` stable and update `updatedAtMs` only after successful verified mutation;
- preserve stable automation identity where relay ownership remains the same;
- if sensor/relay changes create an ownership conflict, fail before destructive mutation;
- failed remote update must not leave local durable state claiming success;
- safe relay behavior remains explicit.

### Slice 2B — edit an installed Time automation in place

Goal: give native Shelly time schedules the same product-level Edit behavior while preserving their different runtime implementation.

Requirements:

- use the shared edit/navigation semantics from 2A;
- use Time's native schedule lifecycle rather than forcing it through the climate script path;
- update durable schedule IDs/config only after verified schedule mutation;
- conflict/failure handling must leave local and remote state explainable.

If 2A exposes a genuinely shared automation-edit contract, extract only that contract. Do not merge climate and Time runtime implementations artificially.

### Slice 3A — Shelly device-settings foundation + complete LED settings

Goal: use LED configuration as the first full vertical slice toward richer Shelly ecosystem compatibility.

Before implementation, inventory the LED configuration actually exposed by the supported test Plug/model and compare it with the current Local Climate Link LED surface. Build the typed Shelly protocol model from observed/documented RPC behavior; do not model the UI by copying another app screen blindly.

Ownership target:

```text
features/plugs device settings UI/flow
        -> @lcl/shelly-client typed config API
        -> ShellyRpcTransport
```

Requirements:

- feature code sees typed LED settings/capabilities, not raw RPC payloads;
- preserve unrelated/unknown device config fields when performing partial updates;
- unsupported options are capability-driven rather than hidden through model-name conditionals scattered through UI;
- HTTP-specific details remain below the product flow;
- complete the LED settings supported by the target device family before adding another settings family.

Physical Shelly verification is part of Definition of Done for this slice.

### Slice 3B+ — expand Shelly settings one capability family at a time

Goal: move toward substantially fuller Shelly management without creating a generic settings God object.

Before choosing each next family, produce/update a small capability inventory from supported Shelly RPC/config surfaces. Then implement one cohesive family per slice, for example switch/output behavior, device/system behavior, connectivity or other high-value supported settings.

For every family:

- typed protocol/config owner in `@lcl/shelly-client`;
- feature-owned presentation/orchestration;
- capability detection where models/generations differ;
- focused unit tests plus physical-device smoke;
- no catch-all `ShellySettingsManager` / `Utils` / raw JSON editor.

The exact settings-family order is intentionally decided from the audited device capability matrix after LED is complete.

### Slice 4A — BLE transport feasibility and protocol spike

Goal: establish what the target Shelly generation actually supports over BLE before changing product flows.

This is a bounded engineering spike, not permission for a speculative repository refactor.

Determine on real hardware:

- discovery/connection requirements;
- GATT services/characteristics and session lifecycle;
- authentication/pairing requirements if any;
- request/response framing, fragmentation and limits;
- which Shelly RPC/config operations are available over BLE;
- timeout/retry/disconnect behavior;
- whether Wi-Fi provisioning can be performed through the channel;
- whether script/config operations needed by Local Climate Link are practical through BLE.

Record a capability matrix and protocol notes in canonical docs. If BLE cannot support some RPC families, keep that limitation explicit rather than pretending transports are equivalent.

No production feature should switch to BLE in this slice unless needed only to validate the transport contract.

### Slice 4B — implement the BLE ShellyRpcTransport boundary

Goal: add BLE as a second transport implementation while keeping Shelly protocol/product logic shared.

Preferred dependency direction:

```text
feature flows
    -> @lcl/shelly-client API
        -> ShellyRpcTransport

platform adapters
    -> HTTP transport construction
    -> BLE transport construction/session binding
```

Do not duplicate Shelly RPC parsing or feature-specific logic inside the BLE adapter.

Transport selection/fallback rules must be explicit and testable. Do not silently bounce between HTTP and BLE during destructive mutations without preserving operation identity and failure semantics.

### Slice 4C+ — enable BLE-backed product capabilities incrementally

Start with a low-risk, clearly supported operation such as device status/settings read, then relay/settings mutation, and only then provisioning or automation-management operations if the feasibility matrix proves them reliable.

Each capability must work through the same product/client API regardless of chosen transport wherever the protocol genuinely permits that equivalence.

Do not make BLE availability a requirement for the existing LAN flow.

## Recovery versus reconstruction policy

The first reported bug requires recovery after a Plug is forgotten and re-added while Local Climate Link durable state still exists. Solve that reliably first.

A stronger future behavior — reconstructing all managed automation state solely from a Shelly after app storage is lost — is valuable but is not silently included in Slice 1 unless the existing managed runtime carries enough verified identity/config metadata to do it safely.

If full reconstruction is desired later, design an explicit device-resident management manifest/identity mechanism rather than heuristically adopting arbitrary scripts or schedules.

## Transport-neutral data policy

As the above slices touch persistence, move toward this conceptual separation:

```text
physical identity
  deviceId
  model/generation metadata

reachability
  last-known HTTP endpoint
  BLE address/session discovery data

managed product state
  InstalledAutomation
  settings state/cache where justified
```

Do not perform a schema rewrite merely to match this diagram. Apply the separation when a touched slice needs it, and replace development-only schemas cohesively according to the repository development-mode contract.

## Progress log

Update this table only after a slice has passed its full completion lifecycle.

| Slice | Status | Main commit | Verification / note |
| --- | --- | --- | --- |
| 0 InstalledAutomation foundation | pending | `0c52c75b2` baseline | Previous attempt failed final full check; no change merged |
| 1A Forget vs uninstall semantics | pending | — | — |
| 1B Re-add + reconciliation | pending | — | — |
| 2A Edit climate automation | pending | — | — |
| 2B Edit Time automation | pending | — | — |
| 3A Full LED settings | pending | — | — |
| 3B+ Additional settings families | pending | — | Order chosen after capability audit |
| 4A BLE feasibility spike | pending | — | Real hardware required |
| 4B BLE transport | pending | — | Depends on 4A |
| 4C+ BLE-backed capabilities | pending | — | Incremental enablement |

## Handoff rule

At the end of every completed slice, `docs/HANDOFF_NEXT_CHAT.md` must be sufficient for a new chat to continue without reading conversation history. It must contain:

- exact `main` commit;
- Local Agent binding and daemon state expectation;
- slice just completed;
- focused/full verification performed;
- any physical-device result;
- unresolved risks or intentional limitations;
- exact next slice from this plan;
- any work branch that still exists and whether it is safe to delete/resume.

Conversation history is supplementary. Repository code + canonical docs + this plan + the current handoff are the source of truth.
