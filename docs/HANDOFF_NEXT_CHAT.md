# Local Climate Link — next chat handoff

Updated: 2026-09-11 06:35 CEST

This is the canonical continuation handoff for the current MANUAL/AUTO runtime-mode work. Read it before changing code.

## Hard repository binding and execution model

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- current Local Agent chat: `chat-904f15d6` (a new ChatGPT window may receive a different `LA_CHAT`; use the bridge-injected value for that new conversation)
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`

Every Local Agent task created by this work must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

Never infer, substitute, inspect, queue, cancel, or execute work for another repository.

Execution rules:

- ChatGPT is the planner; Local Agent executes deterministic commands/scripts only.
- Never invoke, delegate to, or launch local Codex from a Local Agent task.
- Before editing the same work branch, read `.agent/status/daemon.json` and ensure no active task owns it.
- For hybrid GitHub + Local Agent work, verify the exact committed SHA before local validation.
- If a Local Agent task is active and healthy, do not poll every 30 seconds; use at least 2 minutes and normally 5–10 minutes for builds/tests.
- If exact evidence proves an active task cannot succeed, cancel that exact task through repository task control rather than waiting for timeout.
- Follow the Local Agent Chat Bridge hard-binding header injected into the conversation. Bridge controls such as `[LAB:NEXT=2m]`, `[LAB:NEXT=10m]`, `[LAB:PAUSE]`, `[LAB:RESUME]` are conversation-scoped and must never change the global Master switch.
- Follow the repository's `AGENTS.md` plus Local Agent operating rules referenced by the bridge (`docs/AUTONOMOUS_CHAT_LOOP.md`, `docs/OPERATIONS.md`).

## Exact repository state at handoff

Stable product baseline and current `main` before this documentation commit:

```text
377b7bf7a2bca37ab4371b42be82136c2b2aaf13
refactor(mobile): remove redundant settings triggers
```

Feature work branch:

```text
work/manual-runtime-mode-20260911
```

At the time of this handoff that branch still points to exactly the same product baseline SHA:

```text
377b7bf7a2bca37ab4371b42be82136c2b2aaf13
```

Important: there is currently **no committed/pushed MANUAL-live feature implementation on the work branch**. The Local Agent V1–V11 attempts reset the local workspace to the exact baseline before applying deterministic patch scripts; failed attempts did not push a feature commit. Do not assume source changes visible in a failed Local Agent result exist on the remote work branch.

Frozen known-good branch remains:

```text
freeze/working-baseline-20260910
b3b52d5b023d7051b8254cd778490e8e7b1af959
```

Do not move or rewrite the frozen baseline.

## Active product goal

Focus only on the climate automation lifecycle and diagnostics. Do not resume chart/history work unless explicitly requested.

The user chose this architecture:

### AUTO

- managed climate script remains RUNNING
- BLE scanner/runtime remains RUNNING
- `/script/<id>/diag` remains live
- automatic relay decisions are allowed

### MANUAL

- managed climate script still remains RUNNING
- BLE scanner/runtime still remains RUNNING
- `/diag` remains live, so temperature/humidity/VPD telemetry keeps updating
- automatic relay decisions are blocked inside the runtime
- direct phone ON/OFF control is allowed only in verified MANUAL mode

### STOPPED

- means the script process is actually stopped/crashed/maintenance state
- it is not another name for MANUAL

### MISSING

- exact managed script is absent/mismatched

The runtime mode is intentionally in-memory and defaults to AUTO after a normal runtime restart. Do not add KVS persistence unless explicitly requested.

## Runtime-mode transport and safety design

The accepted design uses Shelly's existing `Script.Eval` RPC against the exact stored managed script id.

Generated runtime state uses a compact flag:

```text
R.m = 0  -> AUTO
R.m = 1  -> MANUAL
```

Mode read expression:

```js
typeof R === 'object' && typeof R.m === 'number' ? R.m : -1;
```

Interpretation:

- `0` => AUTO, supported
- `1` => MANUAL, supported
- `-1` or other => old/unsupported runtime; treat it as AUTO + unsupported capability, never invent MANUAL

`/diag` is telemetry-only. Do not duplicate runtime mode into the diagnostic payload.

AUTO -> MANUAL safety boundary:

1. verify exact managed running runtime; upgrade old 0.1 runtime if needed
2. set `R.m=1` using `Script.Eval` before manual relay access
3. clear debounce/hit/internal relay bookkeeping
4. force relay OFF and confirm OFF
5. generated automation output path is gated by `R.m`
6. if an old AUTO `Switch.Set` callback completes after MANUAL wins, callback must issue corrective OFF
7. verify exact live MANUAL + capability + physical relay OFF

MANUAL -> AUTO:

1. require exact live supported MANUAL
2. force and confirm relay OFF while still MANUAL
3. clear transient runtime bookkeeping and set `R.m=0`
4. verify exact live AUTO + relay OFF
5. next BLE measurement may automate normally

Normal AUTO/MANUAL changes must not use `Script.Stop`/`Script.Start`. Those remain valid for install/update/recovery/delete/maintenance and temporary BLE discovery only.

Legacy 0.1 live runtime migration:

- old running runtime reports unsupported via the `-1` expression
- first control-mode action should safely upgrade it in place using current stored configuration
- require exact managed ownership and preserve script id when safe
- force OFF before/after the upgrade
- persist new script hash/update time only after successful upgrade
- an actually stopped old runtime is ambiguous and should go through explicit recovery rather than silently guessing MANUAL

## Local Agent implementation history

Work was repeatedly rebuilt from exact baseline through deterministic scripts on `agent-control`.

V1–V8 were patch-application/test-harness iterations and failed before a feature commit.

V9 reached real generator/runtime tests:

- 68/69 initially passed
- only stale `md:0` / `/diag` mode assertions remained

V10:

- semantic MANUAL/AUTO runtime tests: 69/69 PASS
- failed only strict Xiaomi generated-code budget: 4548 B > 4500 B

V11 introduced a tiny shared `Switch.Set` helper without relaxing the size budget.

V11 evidence:

- `manual-runtime.test.ts`: PASS
- `runtime-matrix.test.ts`: PASS
- semantic runtime total: 69/69 PASS
- `generator.test.ts`: 25/25 PASS
- Xiaomi 4500-byte budget: PASS
- generator snapshots updated successfully in the local task workspace
- core mobile runtime tests passed:
  - `runtimeModeTransport.test.ts`
  - `runtimeStatus.test.ts`
  - `runtimeControl.test.ts`
  - `healthRecovery.test.ts`
  - `runtimeDiagnostics.test.ts`

V11 then failed on three UI tests before commit/push:

1. `automation-dashboard-controls.test.tsx`
   - mock reports MANUAL but lacks the new `runtimeModeSupported` capability
   - UI therefore correctly treats it as requiring attention
   - update the test mock/expectation to the new contract; do not weaken production verification

2. `automation-detail.test.tsx` — pause/resume case
   - old fetch mock does not implement `Script.Eval`
   - old test still expects `Script.Stop` / `Script.Start` and old pause/start toasts
   - update the mock to model a running script plus `R.m` transitions through `Script.Eval`
   - assert script remains running in MANUAL and telemetry remains available

3. `automation-detail.test.tsx` — deployed-script display case
   - runtime verification fails before enabling the button because the old mock lacks the new live-mode RPC contract
   - fix the mock, not the production ownership check

After those UI tests are corrected, rerun the full V11/V12 quality pipeline and only commit/push if everything is green.

Useful existing agent-control files include the V11 runner and earlier patch scripts. Prefer fixing the smallest deterministic failure instead of starting another broad rewrite.

## Real hardware resource measurement — completed

Read-only Local Agent task:

```text
20260911-measure-shelly-script-resources-v1
status: done
```

Hardware reached successfully:

- phone: Samsung Galaxy S22+ / `SM-S906B`
- ADB serial: `RFCT70L7E8J`
- Shelly id: `shellyplugsg3-e4b063d7f530`
- Shelly model: `S3PL-00112EU`
- generation: 3
- firmware: `20260311-095902/1.7.5-g9979d16`

Observed Shelly state during measurement:

```text
SCRIPT_COUNT=1
MANAGED_SCRIPT_COUNT=1
SCRIPT_ID=1
SCRIPT_RUNNING_LIST=false
SCRIPT_RUNNING=False
SCRIPT_MEM_FREE=25116
SCRIPT_CPU=0
SYS_RAM_SIZE=259128
SYS_RAM_FREE=96180
SYS_FS_SIZE=917504
SYS_FS_FREE=450560
SYS_UPTIME=56530
SCRIPT_CODE_BYTES=3674
SCRIPT_META=g: 0.1.0
SCRIPT_META=m: tp357-minimal
SCRIPT_META=h: lcl-d88ac1de
```

Because the currently installed 0.1 script was physically stopped during this measurement, `Script.GetStatus` did not expose meaningful `mem_used` / `mem_peak`. `mem_free=25116` was still available. Repeat the resource measurement after installing/running the new MANUAL-live 0.2 runtime so all script memory fields are populated.

The strict 4500/4000 generated-code tests are repository regression budgets, not a known Shelly hard code-size limit. Do not relax them merely to make a test pass, but also do not trade away safety/functionality for arbitrary bytes if real resource evidence later shows comfortable margins.

## BLE discovery resource behavior — confirmed from code

The user remembered correctly that automation and Shelly-side BLE discovery are not intended to run concurrently.

Current lifecycle in `shellyRequests.ts` / `useHardwareSetupFlow.ts`:

1. force relay OFF
2. remove stale discovery scripts
3. if the managed automation script is running, stop it temporarily
4. install/start a separate temporary BLE discovery script
5. perform discovery
6. stop and delete the temporary discovery script
7. restart the managed automation only if it had been running before discovery

So the discovery script is a separate temporary script id, not an in-place rewrite of the automation slot, but the two JS runtimes do not intentionally compete for the shared script memory pool at the same time.

Do not change this lifecycle as part of the MANUAL-mode task unless evidence requires it.

## New requested diagnostics addition

The user explicitly wants script/device resource information visible in the phone diagnostics UI.

Add it without increasing the generated thermostat runtime payload. The phone can query Shelly RPC directly.

Desired sources:

### `Script.GetStatus` for the exact managed script id

Expose when available:

- `running`
- `mem_used`
- `mem_peak`
- `mem_free`
- `cpu` (firmware-dependent/optional)

### `Sys.GetStatus`

Expose useful whole-device memory context, at minimum:

- `ram_size`
- `ram_free`

Optional filesystem values may be shown only if they fit the existing diagnostics UX cleanly; do not create a large new subsystem for them.

Implementation direction:

- query these from the phone/app, not from generated `/diag`
- keep the generated `/diag` telemetry schema unchanged
- parse optional firmware-dependent fields defensively
- failure of resource telemetry should not make otherwise-valid climate telemetry/control unusable
- show the values in the existing `DiagnosticsSetupPage` Runtime/Shelly diagnostics groups rather than creating a new god component
- use small formatter/helper functions for bytes / percentages
- add focused schema/request tests plus screen/UI assertions
- resource refresh should be part of the existing diagnostics refresh, not a high-frequency polling loop

The existing diagnostics UI is in:

```text
apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx
```

Existing diagnostics flow/state originates in:

```text
apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
apps/mobile/src/flows/hardware-setup/shellyRequests.ts
apps/mobile/src/flows/hardware-setup/schemas.ts
```

Do not put `mem_used/mem_peak/mem_free` into the generated thermostat `/diag` payload.

## Immediate continuation plan

1. Read `.agent/status/daemon.json` and verify repository/binding before any work.
2. Confirm the remote work branch is still exact baseline unless a later task has committed something.
3. Continue from V11, not from V1 and not from the old September-10 release/freeze handoff.
4. Correct only the three stale UI mocks/expectations described above.
5. Integrate read-only `Script.GetStatus` + `Sys.GetStatus` into the existing phone diagnostics flow with focused tests and clean separation.
6. Keep MANUAL-live architecture and generated `/diag` telemetry-only.
7. Run targeted tests first, then the complete generator/mobile/quality/build/Playwright pipeline on one exact committed SHA.
8. Only after all source validation is green, install the exact build on the Samsung S22+ and physically validate the real migration from installed 0.1 runtime to 0.2:
   - script stays running in MANUAL
   - `R.m=1` through `Script.Eval`
   - relay confirmed OFF on mode boundary
   - temperature/humidity/VPD telemetry remains live in MANUAL
   - resource diagnostics show real `mem_used`, `mem_peak`, `mem_free`, optional CPU and device RAM
   - returning AUTO gives `R.m=0`, relay OFF boundary, script still running
9. Leave physical output OFF unless a manual-ON test is truly required; if ON is tested, immediately return it OFF.
10. Inspect the final feature diff before merging `main`; keep `freeze/working-baseline-20260910` untouched.

## Validation expectations after the next committed feature SHA exists

At minimum run via Local Agent against the exact commit:

```sh
pnpm --filter @lcl/script-generator test
pnpm --filter @lcl/mobile test
pnpm --filter @lcl/mobile lint
pnpm --filter @lcl/mobile typecheck
pnpm quality:repo
pnpm quality:ux
pnpm --filter @lcl/mobile build
pnpm --filter @lcl/mobile exec playwright test
```

Also run `git diff --check` and audit that normal user AUTO/MANUAL paths contain no `Script.Stop`/`Script.Start` regression.

## Change philosophy

- evidence-driven
- small, clean, low-risk/high-gain changes
- no god objects
- good separation of runtime transport, safety logic, UI/query state and presentation
- no speculative refactors
- do not weaken ownership/safety checks to make stale tests green
- fix mocks/tests when the accepted runtime contract changed
- preserve strict generated-code budgets unless real evidence justifies a deliberate change
- keep final physical relay state explicit and known
