# Automation recovery, editing and Shelly transport execution plan

Updated: 2026-09-21
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

Status: **done**.

Completed product commit:

```text
05f7eb4b8c83c1583222f374c8f3ebabff7e7703
Edit installed climate automation in place
```

Result:

- climate detail exposes Edit and returns to the same installed automation after save/back;
- the existing climate editor is hydrated from durable `InstalledAutomation` config rather than creating an edit-only form;
- `features/automations` owns edit-draft derivation, management actions and remote edit orchestration;
- stable Shelly `deviceId`, relay ownership and native-schedule conflict are verified before destructive mutation;
- the currently owned managed script must still match the durable script id/hash before replacement;
- relay is forced and confirmed OFF before mutation and again after replacement;
- replacement must retain the managed Shelly script id and the resulting runtime must be running with the exact expected code hash;
- durable automation identity and `installedAtMs` are preserved; `updatedAtMs` advances only after verified remote success;
- failed/conflicting remote edits do not persist the edited durable config as successful;
- hardware setup tab/hash navigation was extracted to a route-owned helper instead of raising architecture budgets.

Verification before integration:

- focused edit-flow, route/detail and hardware-setup suites passed during iteration, including 84/84 focused tests and a final hardware-setup regression run of 56/56;
- `pnpm quality:repo` passed without changing architecture baselines;
- exactly one accepted final full `pnpm check` passed in Local Agent task `20260921-slice2a-edit-climate-v20-final`, including formatting, lint, UX/repository gates, typecheck, tests, core coverage and production builds;
- postimplementation full-diff review found no blocker and confirmed `main` was a clean one-commit fast-forward;
- no physical Shelly smoke was required for 2A because runtime mutation/verification behavior is covered by deterministic service fixtures and existing Shelly client lifecycle tests.

Transport note carried forward: 2A uses the existing `platform/shellyHttpTransport` adapter through `@lcl/shelly-client` RPC APIs and does not call raw HTTP from product UI. Do not introduce speculative BLE selection here; transport selection is generalized only after the real-hardware BLE feasibility slice proves the protocol.

## Slice 2B — edit installed Time automation in place

Status: **done**.

Completed product commit:

```text
e1a4c63e32000a90c22bd02b6c01ae9b37bff536
Edit installed Time automation in place
```

Result:

- Time installation detail exposes Edit and returns to the same installed automation after save/back;
- the existing Time schedule setup page is reused and prefilled from durable `InstalledAutomation` config;
- `features/automations` owns the edit orchestration that verifies live Shelly `deviceId`, durable relay ownership and absence of a managed climate script before mutation;
- the existing `updateDailyTimeAutomation` remains the single owner of native Shelly schedule mutation;
- the exact stored ON/OFF schedule pair is verified before mutation and the same `onJobId` / `offJobId` values are updated in place;
- safe relay OFF, paused/running preservation, post-update verification and rollback remain inside the Time runtime;
- durable automation id, schedule ids and `installedAtMs` are preserved; edited config and `updatedAtMs` are persisted only after verified remote success;
- failed/conflicting remote updates do not persist the edited config as installed;
- `TimeInstallationDetail` no longer owns inline schedule editing or durable edit persistence;
- climate and Time share only the route-level Edit navigation contract; their runtimes remain separate.

Verification before integration:

- focused validation passed 6 test files / 94 tests, including feature edit orchestration, Time runtime, edit prefill, route/detail and hardware-setup regressions;
- mobile typecheck and `pnpm quality:repo` passed, including feature-boundary and quality-gate self-tests;
- exactly one accepted final full `pnpm check` passed in Local Agent task `20260921-slice2b-edit-time-v3-final`, including formatting, lint, UX/repository gates, workspace typechecks/tests, core coverage and production builds;
- postimplementation audit passed without dependency, lockfile or architecture-baseline changes;
- the work branch was squashed to one reviewed product commit and `main` was a clean one-commit fast-forward;
- no physical Shelly smoke was required for 2B because the schedule mutation/rollback contract is already covered by deterministic Time runtime fixtures and typed Shelly schedule-client tests.

Known failure semantics: if a partial remote update fails, the Time runtime attempts to restore both previous schedule definitions and safe relay state. The durable record intentionally remains on the previous config because edited state is not persisted until success. If remote rollback itself cannot be fully restored, runtime health/reconciliation must expose the resulting attention state rather than overwriting ownership evidence.

## Slice 3A — device-settings foundation + complete LED settings

Status: **done**.

Completed product commit:

```text
b0319dddd668c6474b7544c38018518027e3b5f1
Complete Plug S LED settings
```

Result:

- `@lcl/shelly-client` owns typed `PLUGS_UI` LED config, validation, capability derivation and deep-partial LED-only writes;
- supported LED surface covers `power | switch | off`, relay-state ON/OFF RGB + brightness, power brightness and night mode;
- `features/plugs` owns the device-level LED editor and TanStack Query orchestration, reused from saved Plug settings and installed climate/Time details;
- stable physical `deviceId` is verified through `Shelly.GetDeviceInfo` before every LED settings read/write; endpoint address remains reachability only;
- unrelated `PLUGS_UI.controls` data is never emitted by LED mutations;
- unsupported settings are capability-driven from the live config/method surface;
- legacy installation-owned LED flow/component ownership was removed rather than kept as a parallel path;
- real firmware `1.7.5` behavior `night_mode.active_between: []` when disabled is accepted and normalized safely by the editor;
- enabling night mode from an empty window writes an explicit valid window, while brightness-only edits remain brightness-only;
- HTTP remains the current `ShellyRpcTransport` adapter and no BLE behavior was introduced.

Verification before integration:

- focused package/feature tests, typechecks, `quality:repo`, feature-boundary, quality self-test and `quality:ux` passed during iteration;
- focused responsive LED Playwright suite passed `9/9`, including the real empty night-window shape and a saved Plug with no installed automation;
- exactly one accepted final full `pnpm check` passed in Local Agent task `20260921-slice3a-final-check-v2` on the exact product tree, covering formatting, lint, UX/repository gates, all workspace typechecks/tests, core coverage and production builds;
- full-diff audit confirmed no dependency, lockfile or architecture-baseline changes and the branch was squashed without changing the checked tree;
- real Plug S Gen3 `S3PL-00112EU`, device `shellyplugsg3-e4b063d7f530`, firmware `1.7.5` at `http://192.168.0.10/` passed reversible LED smoke: `night_mode.brightness` changed `100 -> 7`, readback matched, then the full original `PLUGS_UI` config was restored exactly;
- the physical smoke began and ended with relay OFF; climate script id `1` (`Local Climate Link Thermostat`) stayed enabled and running;
- a live typed-client read then parsed the real `active_between: []` config and derived a brightness-only patch without mutating hardware.

## Slice 3B — physical button input mode

Status: **done on work branch; integration pending**.

Completed product/test head:

```text
64afc789ec679d7de2ab17b6fab5a588235bf238
Fix Plug button E2E selector
```

Result:

- `@lcl/shelly-client` parses `PLUGS_UI.controls["switch:0"].in_mode`, derives button-mode capability and exposes a typed `momentary | detached` mutation;
- the mutation writes only `controls.switch:0.in_mode` and never emits LED config;
- `features/plugs` owns a separate button-mode data/flow/card path rather than enlarging the LED editor;
- a shared Plug-settings target helper verifies live `Shelly.GetDeviceInfo.id` before every LED/button settings read or mutation;
- the saved physical Plug settings surface exposes the control without moving RPC logic into screens;
- no new production dependency, lockfile change, architecture-baseline increase or speculative BLE behavior was introduced.

Verification before integration:

- focused package/component validation and repository gates passed during iteration;
- responsive Playwright task `20260921-slice3b-e2e-v2` passed 4/4 tests at 360x800, 390x844 and 768x1024, including controls-only mutation evidence;
- hardware task `20260921-slice3b-hardware-smoke-v1` used the typed repository client against real Plug S Gen3 `shellyplugsg3-e4b063d7f530` / firmware 1.7.5 and verified `momentary -> detached -> momentary`;
- LED config stayed byte-equivalent through the hardware mutation and relay output stayed OFF;
- an intermediate pre-push hook ran full `pnpm check` at `880f960df...`; later E2E/docs-only commits followed it, so the accepted final check is Local Agent task `20260921-slice3b-final-check-v1`, which must succeed on the exact tree it commits before integration.

## Slice 3C — next Shelly settings family

Before implementation, audit the real Plug S Gen3 method/config capability matrix plus current official Shelly docs and choose one small user-visible settings family. Keep the same pattern: typed `@lcl/shelly-client` protocol owner, feature-owned orchestration/UI, stable identity verification, narrow writes, focused tests and reversible hardware smoke. Do not create a generic settings God object or raw JSON editor.

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
2A  Edit climate automation               DONE  05f7eb4b8
2B  Edit Time automation                  DONE  e1a4c63e3
3A  Full LED settings                     DONE  b0319dddd
3B  Physical button input mode            DONE  64afc789e
3C  Next Plug settings family             NEXT
4A  BLE feasibility spike                 pending
4B  BLE transport                         pending
4C+ BLE-backed capabilities               pending
```

## Handoff rule

At every completed slice, `docs/HANDOFF_NEXT_CHAT.md` must contain the completed product commit, verification performed, hardware evidence if applicable, unresolved limitations, exact next slice, work-branch disposition and Local Agent binding. A new chat must still fetch fresh `main`; a documentation-finalization commit necessarily comes after the product commit recorded for the slice.
