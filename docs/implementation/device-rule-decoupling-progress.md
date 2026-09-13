# Device/rule decoupling progress

Branch: `work/device-rule-decoupling-20260913`. Do not merge to `main`.

## Current checkpoint

HEAD entering this checkpoint: `a3da0a14` (Phase A). Phase B1 adds the independently
reviewable plug runtime services and hardware smoke; standalone UI and product
cutover remain outstanding. This document is updated in the B1 implementation
commit; its SHA is recorded by the next checkpoint.

Completed implementation commits:

- `a3da0a14` — Phase A: independent device/rule models, persistence and ownership.
- `0a1452c2` — Phase B1: standalone plug runtime services and hardware smoke.

## Completed work

- Dedicated plug, sensor and rule schemas, repositories and injectable Zustand
  stores under `flows/devices`, `flows/rules`, `flows/registry`.
- Canonical Shelly device id, mutable endpoint, profile/runtime-address sensor id,
  independent storage keys, explicit persistence failures and duplicate rejection.
- Rule references, device deletion guards, deployed-rule deletion/rebinding guards,
  current-device resolution and generator input construction.
- Explicit pending/failed/verified climate safety-test metadata retaining exact
  script id/hash. Rules do not embed mutable device snapshots.
- Pure ownership resolver: unknown inventory fails closed; duplicate orphan scripts
  remain individually visible; missing deployments release the relay only after
  complete verified inventory; partial/mismatched deployments remain blocked.
- Shared climate settings validation in script-generator, shared desired daily
  time settings and pure schedule ownership/job helpers. Current callers migrated
  for extracted helpers without compatibility re-exports.
- ADR-0006 records the approved architecture.

## Phase B1 services

- `shelly-client/inventory.ts`: validated method inventory, all exact script ids and
  Switch.GetStatus (no default OFF for missing data).
- Plug registration checks device identity/profile and relay status without calling
  Scripts/BLE/schedules. Runtime inventory distinguishes absent APIs from failed RPCs.
- Direct unowned ON/OFF verifies physical identity, ownership and actual output.
  Failed command verification forces and rereads OFF.
- Orphan cleanup protects owned and unrelated scripts, checks exact name/id again
  after stopping, deletes only that id, then verifies absence and OFF.
- `scripts/hardware/device-rule-plug-smoke.ts` exercises these services against the
  explicitly selected development device. Requires SHELLY_URL + SHELLY_DEVICE_ID;
  refuses to remove pre-existing scripts or schedules.

## Verification

- Installed locked dependencies with `pnpm install --frozen-lockfile`; no dependency
  or lockfile changes.
- New registry/model/reference tests: 19 passed.
- New ownership tests: 11 passed.
- Existing time config/runtime tests: 12 passed.
- Script generator: 94 passed, including snapshots and runtime matrix.
- B1 plug service tests: 15 passed. Shelly client: 49 passed (3 new inventory tests).
- Mobile typecheck, workspace lint, `pnpm quality:repo` and `pnpm quality:ux` passed after final fixes.
- `pnpm build` passed for all workspaces. `pnpm format:check` passed after formatting
  the supplied plan (format-only baseline issue) and a new test file.
- Initial tests exposed missing discriminator fields in test fixtures; fixed.
- Typecheck caught optional `enable` in schedule test fixtures; helper return type
  now describes its always-present `enable` field; recheck passed.

## Hardware and visual state

2026-09-13 Phase B1 service smoke passed on local Shelly Plug S Gen3, firmware 1.7.5:

- stored a plug in an isolated registry with zero rules;
- actual ON verified, actual OFF verified;
- installed a disposable generated LCL climate script, listed its exact orphan id;
- raw ON was blocked while the orphan was present;
- deleted exact orphan, verified absence, registry still contained the plug;
- final `Switch.GetStatus` explicitly verified **OFF**, no test scripts left.

Command: `SHELLY_URL=<local endpoint> SHELLY_DEVICE_ID=<verified physical id> pnpm exec tsx scripts/hardware/device-rule-plug-smoke.ts`.
This is service-level hardware validation, **not** an app UI/route acceptance test.
Plan scenarios 3–9 and complete app-based scenarios 1–2 remain outstanding.

No UI changes or visual audit yet. No callable ChatGPT execution sandbox is exposed
in this session; software checks use the supplied local workspace. Phase B/C must
record the responsive visual audit and any unavailable sandbox validation explicitly.

## ChatGPT audit follow-up

The post-Codex audit found a time-of-check/time-of-use identity gap in B1: direct
relay mutation and orphan script deletion trusted the physical identity checked
earlier in a multi-RPC operation. The service now re-verifies Shelly device id,
model and generation immediately before the destructive relay/script mutation.
Regression tests cover endpoint reassignment between inventory and mutation.

A separate rule-lifecycle concern remains intentionally tracked for the product
cutover: generic registry writes must not let desired rule config drift away from
an attached deployment. This must be solved together with the runtime update
transaction API rather than by a persistence-only restriction that would block
legitimate verified updates. Rule creation also must use the live ownership resolver
before persistence so two rules cannot claim the same relay through normal product
flows.

### Registry audit hardening

The rule registry now rejects a second saved rule for the same `(plugId, relayId)`
and rejects desired configuration/binding changes while deployment metadata is
attached. Deployment-state-only updates remain allowed so safety verification can
advance. A later runtime transaction API must explicitly detach/commit deployment
when editing an already deployed rule.

## Remaining work and exact next step

1. Finish B1 checks and commit this coherent service slice; record its SHA here.
2. Phase B: inspect full Shelly/Sensor pages and adjacent tests, extract dedicated
   management flows, replace device ownership in the hardware draft with new
   registries (no fallback readers), add standalone routes and lifecycle wrappers.
3. Wire the tested B1 services to those flows, resolving the latest registry records
   at each operation; serialize mutations per physical plug (including future rule
   deployment) and invalidate endpoint-sensitive queries. Keep raw control away
   from climate AUTO owners.
4. Phase C: four-item navigation, Rules dashboard and existing-device selectors;
   migrate Android back behavior and all locales/E2E fixtures.
5. Phase D: move climate/time runtime callers to resolved rule references, preserve
   canonical `R.m`, fix BLE discovery mode restoration, safe-test completion, exact
   ownership and time rollback; hardware scenarios 1–9 from the plan.
6. Phase E: remove old installation/draft device contracts and update architecture,
   product and repository docs/gates. Run `pnpm check:full` on the final candidate.

The existing product paths still use their current installation/draft models at
this Phase A checkpoint. New registries have no legacy imports/readers/dual writes;
production cutover is outstanding, not claimed complete. Do not add adapters from
new registries back into persisted `InstalledAutomation` snapshots.
