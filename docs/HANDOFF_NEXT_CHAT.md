# Next chat handoff — clean main + Phase 1 architecture guardrails

Updated: 2026-09-20

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Start here

Before any write:

1. read root `AGENTS.md`;
2. read the nearest nested `AGENTS.md` for the area being changed;
3. read this file;
4. read `docs/architecture/overview.md` and
   `docs/architecture/refactor-boundaries.md`;
5. fetch fresh `main`;
6. fetch `agent-control:.agent/status/daemon.json` and verify no duplicate task.

Repository/runtime identity:

```text
repository: MichalMatu/local-climate-link-starter
default/product branch: main
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

There is no active product work branch to resume. Always treat fresh `main` as the source
of truth.

## Phase 0 + Phase 1 development contract

The repository uses hierarchical agent instructions:

```text
AGENTS.md
apps/mobile/AGENTS.md
packages/AGENTS.md
packages/ui/AGENTS.md
```

Root rules are intentionally concise. More specific rules live near the code they govern.
`scripts/quality/repository-gate.mjs` now mechanically protects this structure and rejects
regrowth of the contracts into large catch-all files.

The key development rule remains the **preimplementation architecture gate**. Before
coding, identify:

```text
product owner
state owner
side-effect owner
UI owner
final file layout
test owner
```

Do not implement a feature into a known-wrong owner and schedule the refactor for later.
If the change would make a hotspot own a new unrelated concern, extract the cohesive
boundary in the same slice.

File size remains an alarm, not a refactor target.

## Phase 1 mechanical enforcement

`pnpm quality:repo` now additionally enforces:

- required root/mobile/packages/UI `AGENTS.md` contracts and their size ceilings;
- the current workspace package dependency DAG;
- `packages/*` must not import from `apps/*`;
- `@lcl/ui` may depend only on `@lcl/design-tokens` among workspace packages and remains
  platform-agnostic;
- a default 350-line hard ceiling for production TS/TSX modules;
- explicit higher budgets only for known existing hotspots;
- existing hardware-setup ownership/public-surface checks.

Do not raise a budget simply because a new feature does not fit in the current file.
Choose/extract the correct responsibility owner instead. A budget change is an
architecture change and must be justified in the canonical architecture docs.

The dependency DAG protected by the gate is:

```text
automation-core  ->
ble-core         -> device-profiles
design-tokens    ->
device-profiles  ->
diagnostics      ->
script-generator -> automation-core + device-profiles
shelly-client    -> diagnostics
ui               -> design-tokens
```

## Phase 1 audit result

A fresh production-source audit was completed before adding the new budgets. No current
package dependency violation or architecture-gate failure was found, so **no broad
refactor was started**.

Important existing hotspots include:

```text
723  apps/mobile/src/flows/hardware-setup/shellyRequests.ts
673  apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
599  apps/mobile/src/screens/AutomationDashboardScreen.tsx
582  apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx
523  apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
629  packages/shelly-client/src/scripts/install.ts
564  packages/script-generator/src/shelly/generate.ts
3333 apps/mobile/src/theme/theme.css
```

These are watchpoints, not immediate cleanup tasks. Exact hard budgets and ownership notes
are documented in `docs/architecture/refactor-boundaries.md`.

The Phase 1 gate implementation was validated by `pnpm quality:repo`, precommit gates and
a full pre-push `pnpm check` before this documentation closeout.

## Product model that must remain stable

```text
physical Plug -> optional installed automation
```

Accepted invariants:

- bottom navigation is **Plugs | Thermometers | Settings**;
- `AppShell` owns persistent bottom navigation and the global toast host;
- page content scrolls independently of that navigation;
- automation setup starts from a concrete Plug;
- Time is a Plug automation type, not a global dashboard section;
- `InstalledAutomation` remains the durable installed-automation entity;
- a saved Plug remains useful without an automation;
- the phone configures/manages/diagnoses; Shelly executes installed runtime locally;
- one relay has one managed automation owner at a time;
- delete/uninstall preserves safe OFF and managed-identity verification.

## Mobile organization direction

Do not mass-move the current technical-layer source tree.

For new cohesive product capabilities, prefer gradual feature ownership under:

```text
apps/mobile/src/features/<feature>/
```

with only the needed `screens/`, `components/`, `flows/`, `state/` or `data/`
subdirectories.

When materially modifying an existing feature, migrate only the touched cohesive slice
when that reduces scatter and can remain behavior-preserving.

`src/app` / `src/routes` remain app-composition boundaries. Product-agnostic reusable UI
belongs in `@lcl/ui`.

## Stable architecture boundaries

- domain packages do not import React/Ionic;
- packages do not import from apps;
- screens do not own raw network/BLE transport;
- hardware pages consume narrow setup contracts;
- `HardwareSetupScreen` remains a coordinator;
- `useHardwareSetupFlow` remains a facade over focused subsystems;
- `@lcl/ui` owns reusable presentation, not product/runtime decisions;
- `AppShell` owns mobile shell geometry;
- repository and UX quality gates must not be weakened to accommodate growth.

Current hotspot/watchlist policy lives in
`docs/architecture/refactor-boundaries.md`.

## Closed UX scope

Do not restart a broad UI consistency sweep without a concrete regression or product
requirement.

The completed standalone Add Plug/Add Thermometer work remains closed unless a real
regression is found.

The global toast contract remains:

```text
AppShell
  -> scrollable page content
  -> app-toast-host
  -> persistent bottom navigation
```

Screens use `AppToastViewport`; they do not render raw `ToastViewport` or own
screen-specific toast offsets.

## Validation workflow

Normal workflow:

```text
fresh main + daemon
-> preimplementation architecture gate
-> smallest cohesive implementation
-> focused checks
-> exactly one final full pnpm check
-> commit/push
-> emulator/physical-device smoke when native/device behavior needs it
```

Canonical geometry-sensitive viewports:

```text
360x800
390x844
412x915
768x1024
1440x900
```

Use Local Agent for local command execution/builds/tests/native/hardware work. Do not run
another coding agent through it.

The local development Shelly relay may be toggled ON/OFF during relevant smoke tests under
the standing authorization in root `AGENTS.md`; leave the final state explicit.

## Next work

Phase 0 and Phase 1 are infrastructure/quality work and are complete after the final docs
check. Do not invent a Phase 2 broad refactor.

Start the next implementation from an explicit product requirement or concrete
regression. Before writing code, use the ownership gate and let the new mechanical limits
force extraction only where the active feature genuinely needs it.

Reasonable product categories remain:

- richer Plug management/configuration;
- additional supported sensor/device profiles;
- additional Plug-owned automation types;
- targeted UX work tied to a concrete usability problem.

## Canonical documentation

Current:

- `AGENTS.md` — repository-wide operating contract;
- `apps/mobile/AGENTS.md` — mobile structure/UX contract;
- `packages/AGENTS.md` — package/domain contract;
- `packages/ui/AGENTS.md` — shared UI contract;
- this file — continuation state;
- `docs/architecture/overview.md` — product/runtime architecture;
- `docs/architecture/refactor-boundaries.md` — ownership, budgets and refactor policy;
- `docs/product/next-functional-steps.md` — product roadmap.

Historical/reference:

- `docs/plan.md`;
- `docs/implementation/device-rule-decoupling-plan.md`;
- `docs/prompts/`;
- older implementation notes/ADRs unless explicitly marked current.

When historical material disagrees with current code/canonical docs, current code +
canonical docs win.
