# Device/rule decoupling progress

Branch: `work/device-rule-decoupling-20260913`. Do not merge to `main`.

## Current checkpoint

Phase A implemented and focused checks passed. This document is part of
its implementation commit (find its SHA with `git log --oneline -- this-file`).
Parent HEAD before implementation: `7eebee4b5a68293039dd2cfa86c4e14a778a0236`. The next checkpoint records the concrete implementation SHA.

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

## Verification

- Installed locked dependencies with `pnpm install --frozen-lockfile`; no dependency
  or lockfile changes.
- New registry/model/reference tests: 19 passed.
- New ownership tests: 11 passed.
- Existing time config/runtime tests: 12 passed.
- Script generator: 94 passed, including snapshots and runtime matrix.
- Mobile typecheck, workspace lint, `pnpm quality:repo` and `pnpm quality:ux` passed after final fixes.
- `pnpm build` passed for all workspaces. `pnpm format:check` passed after formatting
  the supplied plan (format-only baseline issue) and a new test file.
- Initial tests exposed missing discriminator fields in test fixtures; fixed.
- Typecheck caught optional `enable` in schedule test fixtures; helper return type
  now describes its always-present `enable` field; recheck passed.

## Hardware and visual state

No hardware mutation in Phase A; relay state was not read or changed.
No UI changes or visual audit yet. No callable ChatGPT execution sandbox is exposed
in this session; software checks use the supplied local workspace. Phase B/C must
record the responsive visual audit and any unavailable sandbox validation explicitly.

## Remaining work and exact next step

1. Finish Phase A checks and commit this coherent foundation; record its SHA here.
2. Phase B: inspect full Shelly/Sensor pages and adjacent tests, extract dedicated
   management flows, replace device ownership in the hardware draft with new
   registries (no fallback readers), add standalone routes and lifecycle wrappers.
3. Add live plug registration/status/inventory, direct unowned ON/OFF and exact
   orphan cleanup services with focused tests. Verify device id at the current
   endpoint before mutation. Keep raw control away from climate AUTO owners.
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
