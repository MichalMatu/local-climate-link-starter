# Next chat handoff — clean main + Phase 2 feature boundaries

Updated: 2026-09-20

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Start here

Before any write:

1. read root `AGENTS.md`;
2. read the nearest nested `AGENTS.md` for the area being changed;
3. read this file;
4. read `docs/architecture/overview.md`, `docs/architecture/refactor-boundaries.md` and
   `docs/architecture/feature-boundaries.md`;
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

There is no product work branch to resume. Fresh `main` is the source of truth.

## Development contracts

The repository now uses hierarchical instructions:

```text
AGENTS.md
apps/mobile/AGENTS.md
apps/mobile/src/features/AGENTS.md
packages/AGENTS.md
packages/ui/AGENTS.md
scripts/quality/AGENTS.md
```

Before implementation, always identify:

```text
product owner
state owner
side-effect owner
UI owner
final file layout
test owner
```

Do not knowingly implement into the wrong owner and schedule a cleanup refactor later.
File size is an alarm, not a refactor target.

## Phase 0–2 tooling state

Phase 0 made the agent contracts hierarchical and introduced the preimplementation
ownership gate.

Phase 1 made repository/package/layer boundaries mechanical in
`scripts/quality/repository-gate.mjs`, including package dependency direction, package to
app isolation, known hotspot budgets and the default 350-line production-module ceiling.

Phase 2 adds `scripts/quality/feature-boundary-gate.mjs`. `pnpm quality:repo` now runs
both repository and feature gates.

The feature gate enforces:

- the allowed `apps/mobile/src` architectural roots;
- a freeze on new top-level production modules in legacy `screens/`, `flows` and
  `components`;
- new cohesive product capabilities under `apps/mobile/src/features/<feature>`;
- one narrow public `index.ts` for every feature;
- no wildcard feature barrels;
- private feature internals and no cross-feature deep imports;
- no feature-to-feature dependencies by default;
- any reviewed feature dependency must still use the target public API;
- no dependency from a feature back to legacy `src/screens`, `src/routes` or `src/flows`;
- workspace `@lcl/*` subpath imports must match explicit `package.json#exports` entries;
- presentation code cannot directly own raw `fetch`, Capacitor BLE or durable browser /
  Capacitor Preferences storage;
- catch-all feature/module names such as `common`, `shared`, `utils`, `helpers`, `manager`
  and `service` are rejected;
- global stylesheet growth is bounded so feature CSS does not leak back into a shared
  dumping ground.

The current style guardrails are:

```text
apps/mobile/src/theme/theme.css   3334 lines by gate parser
packages/ui/src/styles.css         750 line guardrail
```

The theme number is a baseline freeze, not spare capacity. The gate uses
`split('\n').length`, which is one greater than `wc -l` for the current newline-terminated
file.

No product code was migrated or refactored as part of Phase 2.

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

## Feature-first direction

Do not mass-migrate the current technical-layer source tree.

For a new cohesive product capability use:

```text
apps/mobile/src/features/<feature>/
  index.ts
  screens/
  components/
  flows/
  state/
  data/
```

Create only the directories actually needed.

External callers use the feature `index.ts`; internal files stay private. Shared domain
behavior should normally move to a package rather than create feature coupling.

When materially changing an existing capability, move only the touched cohesive slice if
that creates clearer ownership and can remain behavior-preserving. Otherwise leave stable
legacy code alone.

## Existing hotspot policy

Do not start a broad refactor merely because these files are large. Current important
watchpoints include:

```text
apps/mobile/src/flows/hardware-setup/shellyRequests.ts
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
apps/mobile/src/screens/AutomationDashboardScreen.tsx
apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
packages/shelly-client/src/scripts/install.ts
packages/script-generator/src/shelly/generate.ts
apps/mobile/src/theme/theme.css
```

Exact budgets and responsibility notes are in
`docs/architecture/refactor-boundaries.md`.

If a touched hotspot needs a new unrelated responsibility, extract the responsibility
instead of raising the budget.

## Stable UX/shell boundaries

Do not restart a broad UI consistency sweep without a concrete regression or product
requirement.

The global toast contract remains:

```text
AppShell
  -> scrollable page content
  -> app-toast-host
  -> persistent bottom navigation
```

Screens use `AppToastViewport`; they do not render raw `ToastViewport` or own
screen-specific toast offsets.

The completed standalone Add Plug/Add Thermometer UX remains closed unless a real
regression is found.

## Validation workflow

Normal workflow:

```text
fresh main + daemon
-> preimplementation ownership gate
-> smallest cohesive implementation
-> focused checks
-> exactly one final full pnpm check
-> commit/push
-> emulator/physical-device smoke only when native/device behavior needs it
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

The local development Shelly relay may be toggled ON/OFF during relevant smoke tests under
the standing authorization in root `AGENTS.md`; leave the final state explicit.

## Next work

Phase 0–2 tooling/architecture hardening is complete. Do **not** follow it with a broad
code refactor.

The next concrete product feature or regression should exercise these boundaries from day
one. New feature code goes to the correct owner immediately; existing code moves only
when the active slice gains a real ownership benefit.

Reasonable product categories remain:

- richer Plug management/configuration;
- additional supported sensor/device profiles;
- additional Plug-owned automation types;
- targeted UX work tied to a concrete usability problem.

## Canonical documentation

Current:

- `AGENTS.md` — repository-wide operating contract;
- `apps/mobile/AGENTS.md` — mobile structure/UX contract;
- `apps/mobile/src/features/AGENTS.md` — feature isolation/public API contract;
- `packages/AGENTS.md` — package/domain contract;
- `packages/ui/AGENTS.md` — shared UI contract;
- `scripts/quality/AGENTS.md` — executable quality-tool ownership contract;
- this file — continuation state;
- `docs/architecture/overview.md` — product/runtime architecture;
- `docs/architecture/refactor-boundaries.md` — ownership, budgets and refactor policy;
- `docs/architecture/feature-boundaries.md` — executable feature structure contract;
- `docs/product/next-functional-steps.md` — product roadmap.

Historical/reference:

- `docs/plan.md`;
- `docs/implementation/device-rule-decoupling-plan.md`;
- `docs/prompts/`;
- older implementation notes/ADRs unless explicitly marked current.

When historical material disagrees with current code/canonical docs, current code +
canonical docs win.
