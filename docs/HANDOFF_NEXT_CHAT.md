# Next chat handoff — Slice 0 complete, Slice 1A next

Updated: 2026-09-20

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

Always fetch fresh `main`; do not resume a historical work branch unless this handoff explicitly says to do so.

## Product invariants

```text
physical Plug -> optional installed automation
bottom navigation: Plugs | Thermometers | Settings
phone: configure/manage/diagnose
Shelly: execute installed automation locally
```

Keep these invariants:

- a saved Plug remains useful without automation;
- Time is a Plug automation type, not a global dashboard section;
- `InstalledAutomation` is the durable managed-automation record;
- one Plug relay has one managed automation owner at a time;
- uninstall/delete keeps managed-identity verification and safe-OFF behavior;
- `deviceId` is physical Shelly identity;
- IP / `baseUrl` is HTTP reachability and must not become the ownership key;
- future BLE is another transport under the Shelly client boundary, not a second product implementation.

## Slice lifecycle

For every product slice:

```text
fresh main + idle daemon
-> preimplementation ownership/identity/transport audit
-> smallest cohesive implementation
-> focused tests
-> quality:repo when boundaries are touched
-> exactly one final full pnpm check
-> hardware/native smoke only when acceptance requires it
-> postimplementation full-diff re-audit
-> update canonical docs + execution plan + handoff
-> commit/push
-> review pushed diff
-> fast-forward main
-> verify main
```

Do not raise architecture baselines to make a slice fit. New cohesive product modules belong under `apps/mobile/src/features/<feature>`; package protocol/domain behavior stays in packages; screens do not own transport or persistence.

## Last completed slice — Slice 0

Slice 0 is complete and integrated.

```text
product commit: 60295d5769a798bd20bdf70869ae8e256491ed18
message: Move installed automation state to feature
validated work branch: work/installed-automation-feature-foundation-v7
Local Agent final task: 20260920-installed-automation-feature-foundation-v8
```

Verification before integration:

- 8 focused mobile test files / 94 tests passed;
- `pnpm quality:repo` passed;
- exactly one final full `pnpm check` passed, including format, lint, UX/repository gates, typecheck, full tests, core coverage and build;
- postimplementation ownership/public-API re-audit passed;
- no physical Shelly test was required because the slice is behavior-preserving ownership work.

Resulting ownership:

```text
features/automations
  data/installedAutomation.ts
  data/installedAutomationRepository.ts
  data/timeAutomationConfig.ts
  state/installedAutomationStore.ts
  index.ts public API

legacy flows/installations/{model,repository,store}.ts
legacy flows/time-automation/config.ts
  -> thin compatibility shims only
```

The work branch is complete and should not be resumed for new product work. Start Slice 1A from fresh `main`.

## Important unresolved regression

Slice 0 intentionally did **not** fix the user-visible recovery bug.

Current problem to preserve as the test scenario:

```text
Plug has a managed automation
-> user forgets/removes the Plug from Local Climate Link
-> same physical Plug is added again
-> app shows it as a Plug without its old automation
```

The fix is split deliberately:

```text
Slice 1A: Forget Plug must not destroy durable automation ownership
Slice 1B: re-adding same deviceId must reconcile and show the existing managed automation
```

Do not collapse both into an unreviewed broad rewrite.

## Immediate next slice — Slice 1A

**Separate Forget Plug from Uninstall Automation.**

First reproduce and audit the current path. Determine exactly where Plug removal affects:

```text
saved Plug record
InstalledAutomation record/store
screen filtering/composition
remote Shelly runtime
```

Do not assume the local record is deleted until the code proves it; the visible bug could also be caused by filtering or identity association.

Required post-1A semantics:

```text
Forget Plug
  -> removes the saved Plug management/discovery entry
  -> does NOT uninstall the Shelly runtime
  -> does NOT destroy durable InstalledAutomation ownership

Explicit Uninstall Automation
  -> remains the destructive remote-removal path
  -> verifies managed identity
  -> preserves safe-OFF behavior
```

Minimum acceptance scenario:

```text
add Plug
-> install managed automation
-> Forget Plug without uninstall
-> durable InstalledAutomation ownership still exists
```

Test both climate and Time ownership if they share the affected path. If they do not, document the difference instead of forcing one abstraction.

Do not implement full re-add/reconciliation in 1A unless the audit proves a tiny inseparable boundary. Slice 1B owns stable-`deviceId` matching, endpoint refresh and remote-runtime reconciliation.

## What follows

```text
1B  re-add same physical Plug + reconcile managed automation
2A  edit installed climate automation in place
2B  edit installed Time automation in place
3A  device-settings foundation + complete LED settings
3B+ additional Shelly settings families
4A  real-hardware BLE feasibility/protocol spike
4B  BLE ShellyRpcTransport
4C+ incremental BLE-backed capabilities
```

The detailed acceptance criteria and cross-cutting transport/identity rules live in `docs/implementation/automation-recovery-editing-shelly-transport-plan.md`.

## Local Agent state note

The product Slice 0 task completed successfully. Afterward the daemon stopped consuming newly queued documentation-only tasks while its status file still reported `idle`; therefore Slice 0 handoff finalization was performed through deterministic GitHub Git-data writes rather than pretending the daemon had executed it.

Before Slice 1A, fetch `agent-control:.agent/status/daemon.json` again. If its `updated_at` is stale or it does not consume a fresh task, treat Local Agent availability as a tooling issue and do not claim local command execution occurred.

## Canonical docs

Current sources of truth:

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

Historical plans are reference only. When historical material conflicts with current code/canonical docs, current code + canonical docs + the active execution plan win.
