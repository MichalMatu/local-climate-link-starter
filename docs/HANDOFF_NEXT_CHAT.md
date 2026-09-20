# Next chat handoff — product execution plan active

Updated: 2026-09-20

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Start here

Before any write:

1. read root `AGENTS.md`;
2. read the nearest nested `AGENTS.md` for the area being changed;
3. read this file;
4. read `docs/implementation/automation-recovery-editing-shelly-transport-plan.md`;
5. read `docs/architecture/overview.md`, `docs/architecture/refactor-boundaries.md` and
   `docs/architecture/feature-boundaries.md`;
6. fetch fresh `main`;
7. fetch `agent-control:.agent/status/daemon.json` and verify no duplicate task.

Repository/runtime identity:

```text
repository: MichalMatu/local-climate-link-starter
default/product branch: main
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

There is no product work branch to resume. Fresh `main` is the source of truth.

## Development contracts

Hierarchical instructions:

```text
AGENTS.md
apps/mobile/AGENTS.md
apps/mobile/src/features/AGENTS.md
packages/AGENTS.md
packages/ui/AGENTS.md
scripts/quality/AGENTS.md
```

Before implementation identify:

```text
product owner
state owner
side-effect owner
UI owner
final file layout
test owner
```

Do not knowingly implement into the wrong owner and schedule cleanup later. File size is
an alarm; responsibility is the boundary.

## Phase 0–3 architecture tooling

Phase 0 introduced hierarchical agent contracts and the preimplementation ownership gate.

Phase 1 made repository/package/layer boundaries executable in
`scripts/quality/repository-gate.mjs`, including package dependency direction, package to
app isolation and production-module growth protection.

Phase 2 added `scripts/quality/feature-boundary-gate.mjs` and feature-first boundaries.

Phase 3 closes the tooling loop:

- mutable reviewed baselines live in `scripts/quality/architecture-baseline.mjs`;
- known oversized production hotspots are frozen at their exact current parser counts;
- package DAG and reviewed feature dependency exceptions are centralized there;
- the complete current production path set under legacy `screens/`, `flows` and
  `components` is frozen recursively, so nested-directory bypasses are rejected;
- `pnpm quality:selftest` runs deterministic temporary-fixture regression tests for both
  repository and feature gates;
- `pnpm quality:repo` runs repository gate, feature gate and the self-test suite;
- `scripts/quality/AGENTS.md` is itself protected by `repository-gate.mjs`;
- no product behavior or product code was refactored by Phase 3.

Current exact shared-style baselines:

```text
apps/mobile/src/theme/theme.css   3322 lines by gate parser
packages/ui/src/styles.css         672 lines by gate parser
```

These are accepted baselines, not spare capacity.

## Product model that must remain stable

```text
physical Plug -> optional installed automation
```

Accepted invariants:

- bottom navigation is **Plugs | Thermometers | Settings**;
- `AppShell` owns persistent bottom navigation and the global toast host;
- page content scrolls independently;
- automation setup starts from a concrete Plug;
- Time is a Plug automation type, not a global dashboard section;
- `InstalledAutomation` remains the durable installed-automation entity;
- a saved Plug remains useful without an automation;
- the phone configures/manages/diagnoses; Shelly executes installed runtime locally;
- one relay has one managed automation owner at a time;
- delete/uninstall preserves safe OFF and managed-identity verification.

For the active execution plan, also preserve the distinction between stable physical
Shelly identity and transport reachability: `deviceId` is identity; an IP/`baseUrl` is an
HTTP endpoint and must not become the ownership key.

## Feature-first direction

Do not mass-migrate the current technical-layer source tree.

New cohesive product capabilities use:

```text
apps/mobile/src/features/<feature>/
  index.ts
  screens/
  components/
  flows/
  state/
  data/
```

Create only directories actually needed. External callers use the feature `index.ts`;
internal files remain private.

Existing legacy files can remain where they are. A bug fix or cohesive change does not
require refactoring the whole file. But new product modules must not be added anywhere
under legacy `screens/`, `flows` or `components`; a new cohesive capability belongs under
`features/<feature>`.

Shared domain behavior should normally move to a package instead of creating feature
coupling.

## Baseline and hotspot policy

The default production TS/TSX module ceiling remains 350 lines. Larger existing files are
listed with exact reviewed counts in `scripts/quality/architecture-baseline.mjs`.

A protected old file may remain large. Do not raise its baseline merely because a new
change is easiest there. If the file shrinks, lower the baseline when practical. If a new
responsibility would make it grow, create/extract the correct owner instead.

Important watchpoints remain:

```text
apps/mobile/src/flows/hardware-setup/shellyRequests.ts
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
apps/mobile/src/screens/AutomationDashboardScreen.tsx
apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
packages/shelly-client/src/scripts/install.ts
packages/script-generator/src/shelly/generate.ts
apps/mobile/src/theme/theme.css
```

## Stable UX/shell boundaries

Do not restart a broad UI consistency sweep without a concrete regression or product
requirement.

The toast/navigation contract remains:

```text
AppShell
  -> scrollable page content
  -> app-toast-host
  -> persistent bottom navigation
```

Screens use `AppToastViewport`; they do not render raw `ToastViewport` or own
screen-specific toast offsets.

## Validation workflow

The active execution plan strengthens the normal loop with a mandatory postimplementation
re-audit and handoff update:

```text
fresh main + daemon
-> preimplementation ownership/identity/transport gate
-> smallest cohesive implementation
-> focused checks
-> pnpm quality:repo when architecture boundaries are touched
-> exactly one final full pnpm check
-> postimplementation re-audit of the complete diff
-> update canonical docs + this handoff + plan progress
-> commit/push
-> review pushed diff
-> fast-forward main
-> verify main + cleanup branch
```

Useful quality commands:

```text
pnpm quality:ux
pnpm quality:selftest
pnpm quality:repo
pnpm check
```

Canonical geometry-sensitive viewports:

```text
360x800
390x844
412x915
768x1024
1440x900
```

Use Local Agent for local command execution, builds/tests, native or hardware work. Do not
run another coding agent through it.

## Active execution plan

The canonical next-work sequence is now:

```text
Slice 0   close InstalledAutomation feature-foundation move
Slice 1A  separate Forget Plug from Uninstall Automation
Slice 1B  re-add same physical Plug + reconcile managed automation
Slice 2A  edit installed climate automation in place
Slice 2B  edit installed Time automation in place
Slice 3A  device-settings foundation + complete LED settings
Slice 3B+ additional Shelly settings capability families
Slice 4A  real-hardware BLE feasibility/protocol spike
Slice 4B  BLE ShellyRpcTransport implementation
Slice 4C+ incrementally enable BLE-backed product capabilities
```

Detailed acceptance criteria and the mandatory per-slice lifecycle live in
`docs/implementation/automation-recovery-editing-shelly-transport-plan.md`.

Do not reorder later slices around a red/incomplete earlier slice unless a newly discovered
blocker is documented in both that plan and this handoff.

### Immediate next slice: Slice 0

Close the already-attempted `InstalledAutomation` ownership move before implementing the
re-add regression.

Known previous attempt:

```text
task: 20260920-installed-automation-feature-foundation-v3
result: failed final full check
work branch: work/installed-automation-feature-foundation
branch state after failure: identical to main; no partial product change to resume
```

The focused tests and architecture gates passed, but the full mobile suite failed in
`src/__tests__/script-preview.test.ts` because `createInstalledAutomation` was no longer
resolved after the intended public-API move. Fix the public API/caller boundary rather than
reverting ownership back to legacy flows.

After Slice 0 is green and merged, update this handoff and advance to Slice 1A only.

## Canonical documentation

Current:

- `AGENTS.md` — repository-wide operating contract;
- `apps/mobile/AGENTS.md` — mobile structure/UX contract;
- `apps/mobile/src/features/AGENTS.md` — feature isolation/public API contract;
- `packages/AGENTS.md` — package/domain contract;
- `packages/ui/AGENTS.md` — shared UI contract;
- `scripts/quality/AGENTS.md` — quality-tool ownership/self-test contract;
- `scripts/quality/architecture-baseline.mjs` — executable reviewed baselines;
- this file — continuation state;
- `docs/implementation/automation-recovery-editing-shelly-transport-plan.md` — active
  product execution plan and progress log;
- `docs/architecture/overview.md` — product/runtime architecture;
- `docs/architecture/refactor-boundaries.md` — ownership, baselines and refactor policy;
- `docs/architecture/feature-boundaries.md` — executable feature structure contract;
- `docs/product/next-functional-steps.md` — broader product roadmap.

Historical/reference:

- `docs/plan.md`;
- `docs/implementation/device-rule-decoupling-plan.md`;
- `docs/prompts/`;
- older implementation notes/ADRs unless explicitly marked current.

When historical material disagrees with current code/canonical docs, current code +
canonical docs + the active execution plan win.
