# Local Climate Link — next chat handoff

Updated: 2026-09-12

This is the canonical continuation handoff. Read it before changing code.

## Hard repository binding and execution model

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`

Every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

ChatGPT plans; Local Agent executes deterministic commands/scripts. Never launch local Codex from a Local Agent task. Before editing the work branch, read `.agent/status/daemon.json` and proceed only when repository, binding and task state match.

## Frozen accepted application baseline

The exact application build accepted by the user on the physical Samsung SM-S906B is:

```text
8173f0851adc77222fc3e98b02113ff28f7119fd
Use contextual setup back label
```

It is frozen by the annotated tag:

```text
stable-20260912-v2.0.10-ux-polish
```

Do not move or recreate that tag. It is the rollback point for the completed v2.0.10 UX/architecture cleanup.

`main` now contains the completed v2.0.10 UX/architecture cleanup. The stable tag above remains the immutable rollback point for the exact user-accepted application build, while later documentation-only commits may sit above it on `main`.

## Completed 2026-09-12 UX and architecture pass

The completed tranche includes:

- compact Shelly and sensor setup surfaces with round `+` add actions,
- climate-only Add automation choices on the Climate dashboard,
- direct Time setup from the Time dashboard without an intermediate intent chooser,
- contextual setup back label: `Zmień cel` for climate flows and `Anuluj` for direct Time setup,
- two-field ON/OFF daily schedule editor with the custom HH/MM wheel picker,
- no raw Shelly URL/IP on the normal schedule surface,
- preserved sensor readings when switching setup tabs; fresh process launch waits for the next BLE advertisement by design,
- render-safe LAN scan input: incomplete IP ranges no longer throw while the user is typing,
- setup feedback/lifecycle orchestration extracted from the largest pages,
- advanced rule settings extracted into a focused modal component,
- `useHardwareSetupFlow.ts` reduced to a composing façade of roughly 575 lines,
- `ShellySetupPage.tsx`, `SensorSetupPage.tsx` and `RuleSetupPage.tsx` reduced to cohesive page composition,
- architecture regression budgets added to `pnpm quality:repo`,
- current architecture documented in `docs/architecture/refactor-boundaries.md`.

No algorithm redesign was included in this pass. The VPD assist keeps its existing behavior and safety semantics.

## Final validation state

Before closure, the exact accepted application SHA passed:

- `pnpm check:full`, including format, lint, UX/repository quality gates, typecheck, all workspace tests, core coverage, build and responsive Playwright,
- responsive Playwright matrix: 25/25,
- production-code hygiene audit for TODO/FIXME/HACK, `@ts-ignore`, unnecessary `as any` and debug console calls,
- relative documentation-link audit,
- physical Android install/cold-start path on Samsung SM-S906B.

The automated final phone script initially stopped because the clean install selected English while the assertion expected Polish text. Build/install succeeded and this was not an application regression. The user then manually verified the final UI flow on the physical phone and confirmed it works.

## Runtime invariants that must not regress

### AUTO

- exact managed climate script remains running,
- BLE runtime and diagnostics remain live,
- automatic relay decisions are allowed.

### MANUAL

- exact managed climate script still remains running,
- BLE/runtime diagnostics remain live,
- automatic output decisions are blocked inside the generated runtime,
- direct phone ON/OFF is allowed only after verified MANUAL ownership/capability.

### STOPPED / MISSING

These are maintenance/failure states, not aliases for MANUAL. Normal AUTO/MANUAL switching must not use `Script.Stop`/`Script.Start`.

## Architecture boundaries

Keep these responsibilities separate:

- `useHardwareSetupFlow.ts` composes narrow hardware capabilities; it must not regain low-level transport, scan, diagnostics or install implementations,
- `useShellySetupScanFlow.ts` owns LAN scan execution and validation timing,
- `useHardwareDiagnosticsFlow.ts` owns diagnostics/resource snapshots,
- `useClimateAutomationInstallFlow.ts` owns install/conflict handling and safe relay testing,
- `useShellyControlFlow.ts`, `useShellyBleDiscoveryFlow.ts` and `usePhoneSensorFlow.ts` remain device lifecycle boundaries,
- setup-page feedback hooks own transient lifecycle/toast/error orchestration,
- page components own page-level composition and user intent, not transport implementation.

Line-count budgets in `scripts/quality/repository-gate.mjs` are regression alarms, not refactor targets. Split code only at a real responsibility boundary.

## Branch state after cleanup

Keep:

- `main` — integrated v2.0.10 UX/architecture baseline and canonical product branch,
- `agent-control` — Local Agent control/evidence branch.

The completed `work/ux-polish-20260911` branch and the older Stage 1/checkpoint branches are obsolete after the fast-forward and are removed. Start future product work from the current `main` on a new task-specific branch.

## Canonical planning documents

Use these roles consistently:

- `docs/HANDOFF_NEXT_CHAT.md` — current continuation state,
- `docs/product/next-functional-steps.md` — active product roadmap,
- `docs/ux-polish-backlog.md` — only remaining/deferred UX follow-ups after the completed pass,
- `docs/plan.md` — historical MVP/design context,
- `docs/architecture/` and `docs/adr/` — current architecture and decisions,
- `docs/implementation/` — durable implementation contracts/history.

Do not create another continuation/TODO document unless one of these roles genuinely cannot hold the information.

## Next product work

No new product slice is started by this closure. The current roadmap still identifies expanded Shelly LED configuration through the existing `PLUGS_UI` client as the next candidate vertical slice. Re-audit that scope before implementation and keep it app/device-native; do not add LED ownership to the generated climate script.

## Change philosophy

- evidence-driven,
- small, clean, low-risk/high-gain changes,
- no god objects,
- no duplicate state/RPC paths,
- preserve runtime safety semantics,
- prefer device-native Shelly features,
- keep normal user UI calm and diagnostics progressively disclosed.
