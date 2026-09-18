# Next chat handoff — Developer tools / diagnostics cleanup

Updated: 2026-09-18

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Immutable repo / Local Agent binding

Work only on:

```text
repository: MichalMatu/local-climate-link-starter
runtime catalog repo id: local-climate-link-starter
work branch: work/plug-screen-automation-entry-20260917
control branch: agent-control
Local Agent binding: e75c77cb-7589-4452-94b2-decc97ff85a1
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Every Local Agent task JSON created by this chat must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

Do not infer or substitute another repo under this binding.

Before every Local Agent task, read `.agent/status/daemon.json`. Never edit the work branch while a Local Agent task is active.

## Exact continuation point

Last completed PRODUCT commit before this handoff:

```text
2f7364544015db1b1be8cc8b43366efca0f09922
Standardize contextual info placement
```

The handoff documentation commit is newer than the product commit. Treat `2f736454...` as the last validated product checkpoint and the current branch HEAD as documentation-only until the Developer tools cleanup is implemented and validated.

At handoff time the Local Agent daemon is idle. The last task was:

```text
20260918-developer-tools-scope-cleanup-phone-v76
status: failed
```

No product commit from v74-v76 was pushed. The remote work branch product state therefore remains `2f736454...` plus this handoff documentation commit.

Do NOT depend on the failed task's dirty workspace. Reconstruct from the remote branch in one coherent implementation pass.

## Current stable product model

Keep these decisions unchanged:

- bottom navigation: `Plugs | Thermometers | Settings`;
- automation creation starts from a concrete Plug;
- Time is a Plug automation type, not a global Time surface;
- `InstalledAutomation` is the durable installed automation entity;
- a plain saved Plug remains useful before/after automation assignment;
- phone BLE and Shelly BLE discovery feed the same saved sensor/readings model;
- display name is separate from hardware identity (`model` + `gen`);
- one relay owner: do not let climate automation and another scheduler/owner control the same relay without explicit combined-control design.

## Recent completed UI work — do not regress

### Shared styled selects

Commit:

```text
7a5f6c26f7c229c024cdaddedae3a03a63ca992e
Replace native selects with shared listbox
```

All current mobile production native selects were migrated to the shared styled `SelectField` / listbox pattern. Android/WebView system select popups must not return.

### Shared contextual info popovers

Commit:

```text
d5037a48a7670838845e01926ec9f5b86303fcc0
Unify contextual info popovers
```

Contextual help uses the shared `InfoPopover`. `Escape` closes only the top info layer rather than the underlying modal.

### Contextual info placement / viewport safety

Commit:

```text
2f7364544015db1b1be8cc8b43366efca0f09922
Standardize contextual info placement
```

Canonical UI rule:

- contextual `i` belongs directly beside the label/title it explains;
- right edge is for actions/state controls such as gear, delete, refresh, checkbox/toggle;
- shared `InfoLabel` owns field-label + info placement;
- modal title info is rendered beside the title;
- `InfoPopover` is clamped to the phone viewport;
- do not reintroduce ad-hoc `IconInfoCircle` placement.

The user visually checked this on the phone and said it is sufficiently good.

Verification for `2f736454...`:

- focused `hardware-setup.test.tsx`: 61/61 passed;
- full `pnpm check`: passed;
- installed on Samsung SM-S906B / Android 16;
- package `link.localclimate.app`, versionName `2.0.10`, versionCode `20010`;
- MainActivity top-resumed;
- device smoke check found no app FATAL/ANR.

## Active goal: Developer tools / diagnostics cleanup

The user supplied phone screenshots of:

1. the Rule page `Developer tools` section with four large stacked buttons;
2. `Shelly Script preview` modal;
3. the old setup-time `Developer diagnostics` screen before a rule exists;
4. the same old diagnostics screen with script data present;
5. nested diagnostic cards/groups including Input/Processing/Output, BLE/sensor, Script/clock, Shelly telemetry.

The user explicitly approved an architecture-first cleanup before deciding final metric placement.

### Problems confirmed by screenshots and code audit

The current setup Developer tools mixes three ownership domains:

- setup-time script inspection/recovery;
- installed automation diagnostics;
- generic Shelly/device diagnostics.

The old `DiagnosticsSetupPage` is a legacy global/setup surface. It has:

- a separate Shelly selector;
- persisted `diagnosticShellyId` state;
- manual `Refresh diagnostics`;
- a hidden/pseudo `#diagnostics` setup tab;
- nested cards inside a surrounding setup card/context;
- an error state when no LCL automation script exists, because it reads `/script/{id}/diag`.

This no longer matches the product model where automation entry starts from a concrete Plug.

There are effectively two diagnostics systems today:

1. legacy setup diagnostics:
   - `apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx`
   - `apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts`
   - separate `diagnosticShellyId` in `setupDraftStore.ts`;
2. installed automation diagnostics:
   - `apps/mobile/src/screens/InstallationDiagnosticsModal.tsx`
   - `apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts`
   - directly bound to a concrete `InstalledAutomation`;
   - already supports automatic polling and focus/reconnect semantics.

The installed-automation model is the canonical direction.

## APPROVED FIRST IMPLEMENTATION BATCH

Do this before redesigning which individual metrics live where.

### 1. Developer tools on Rule setup: only two setup-owned actions

Keep:

- `Shelly Script preview`;
- `Load from Shelly` (existing rule recovery/import into the form).

Remove from Rule setup Developer tools:

- `Remove from Shelly`;
- `Open technical diagnostics`.

The current four huge vertically stacked buttons are visually too heavy. Present the two remaining setup actions as a compact pair/group without changing their underlying semantics.

`Load from Shelly` is valid setup functionality: it reads the existing managed script, decodes it, and restores sensor, mode, thresholds, VPD and advanced settings into the draft form.

### 2. Delete automation belongs to InstalledAutomation, not setup Developer tools

Do not keep the setup-time script-delete path just because it already exists.

Installed automation deletion already has the correct safety semantics under `flows/installations/*`: verify managed script identity, reject conflicts, force relay OFF, stop/delete, and verify the result.

Remove setup-owned delete UI/state/mutation where no longer needed.

### 3. Remove legacy setup diagnostics surface

Remove the old setup diagnostics concept rather than restyling it:

- remove `DiagnosticsSetupPage.tsx`;
- remove setup `DiagnosticsSetupFlow` contract;
- remove hidden `diagnostics` tab/hash route from `HardwareSetupScreen`;
- remove `Back to rule` developer diagnostics context;
- remove persisted `diagnosticShellyId` and setter from `setupDraftStore`;
- remove legacy setup diagnostic composition from `useHardwareSetupFlow`;
- remove `useHardwareDiagnosticsFlow.ts` and its focused test if no longer referenced;
- remove the install-flow dependency on `refreshDiagnostics` after the safe relay test.

Automation diagnostics should not be offered before an installed automation exists.

### 4. Installed automation diagnostics becomes the only automation diagnostics surface

Keep `InstallationDiagnosticsModal` bound to the concrete `ClimateInstalledAutomation`.

It already queries through `useInstalledAutomationDiagnostics` / `useInstalledAutomationResourceDiagnostics` and can self-refresh.

Remove the visible/manual refresh action from the diagnostics UI. Use automatic refresh as the normal pattern.

Current established runtime refresh patterns to respect:

- plain Plug runtime: 5 s while active, no background polling, mount/focus/reconnect refetch;
- installed automation default runtime: 30 s;
- open `InstallationDiagnosticsModal`: currently 3 s via `INSTALLATION_DIAGNOSTICS_REFRESH_MS`.

Do not introduce another hand-written polling mechanism if React Query already owns the query lifecycle.

### 5. Technical modal/workspace consistency

`Shelly Script preview` is already reasonably good visually and uses the shared `Modal` + `ScriptPreview` path.

The next implementation should make long technical views follow one shared technical-workspace modal pattern rather than each modal having arbitrary geometry.

Do NOT force short confirmation/delete dialogs to become full-height workspaces. The common pattern is for long technical content, not every modal regardless of purpose.

### 6. Do NOT yet redistribute all metrics

That is the NEXT design phase, after the surface cleanup is stable.

Expected future ownership split, not yet the first batch:

Plug/device settings candidates:

- model/gen;
- base URL / open Shelly panel;
- firmware;
- Wi-Fi RSSI;
- uptime / NTP / clock;
- Scripts/Bluetooth/Matter state;
- power, voltage, current, energy;
- plug temperature;
- Shelly RAM/system telemetry.

Installed automation diagnostics candidates:

- automation Input -> Processing -> Output;
- effective thresholds / control value / reason;
- rule relay vs Shelly relay;
- selected sensor and BLE packet state;
- config hash;
- managed script running state;
- script CPU/memory;
- automation-specific runtime state.

Do not move these yet until the user reviews the cleaned surface.

## Failed Local Agent attempt v76 — exact continuation clue

Task:

```text
20260918-developer-tools-scope-cleanup-phone-v76
```

It reconstructed the approved cleanup from the clean remote `2f736454...` and successfully reached mobile typecheck, but failed in `pnpm quality:ux` because the UX gate still contains a hard-coded path to the file that the cleanup deletes:

```text
apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx
```

The exact error was `ENOENT` while `scripts/quality/ux-gate.mjs` tried to open that deleted file.

Known stale quality-gate references that must be audited when deleting the page:

- `scripts/quality/ux-gate.mjs` includes `DiagnosticsSetupPage.tsx` in `hardwareSetupPagePaths` / feedback-contract page paths;
- `scripts/quality/repository-gate.mjs` has a page-to-contract mapping for `DiagnosticsSetupPage.tsx -> DiagnosticsSetupFlow`.

The v76 production code got through `@lcl/mobile typecheck` before the UX-gate failure. The failure does NOT prove the UI/architecture patch itself is invalid; the quality tooling must be migrated with the removed surface.

For reference only, the control branch contains the previous deterministic patch script:

```text
.agent/scripts/20260918-developer-tools-scope-cleanup-v74.py
```

It is useful for understanding intended edits, but do not blindly depend on failed local state. Re-audit against current remote branch and make one coherent patch including quality gates and tests.

## Required regression coverage for the first batch

Update tests to lock the architecture, not old copy/layout details.

At minimum protect:

- Rule Developer tools exposes exactly the two approved setup actions;
- setup no longer exposes `Remove from Shelly` or `Open technical diagnostics`;
- no setup `#diagnostics` pseudo-route/page remains;
- no standalone diagnostic Shelly selector/manual setup refresh remains;
- installed automation diagnostics opens for the concrete installation;
- open installed diagnostics uses automatic polling;
- no visible manual refresh action is required for normal diagnostics updates;
- existing safe automation deletion stays under InstalledAutomation ownership;
- script preview remains available and functional;
- `Load from Shelly` recovery remains functional.

Do not revive stale broad responsive E2E as a blocker for this focused batch unless it directly covers this current navigation path. The old responsive spec contains known stale expectations from previous UI generations.

## Process guardrails — user explicitly wants the fast flow

The user was unhappy with long chains of tiny retry tasks. Use this workflow:

```text
one coherent implementation pass
-> focused lint/typecheck/tests
-> one full pnpm check
-> commit/push
-> one Android build/install + focused device smoke
```

Do not run a full Android rebuild after every micro-fix.
Do not create a new patcher/task for every one-line correction if it can be fixed coherently before the validation pass.
Do not add full responsive E2E to a small UX/refactor batch by default.

After a Local Agent task is queued, do a quick health check to confirm it was actually picked up and did not fail immediately. Once confirmed healthy/running, do not poll faster than the Local Agent contract allows; use >=2 minutes for healthy work.

## First actions in the new chat

1. Read `AGENTS.md`.
2. Read this file in full.
3. Read `.agent/status/daemon.json` on `agent-control`.
4. Verify remote work branch / workspace / clean working tree.
5. Confirm the product baseline is still `2f736454...` beneath this handoff-doc commit.
6. Re-audit the files touched by the approved first Developer tools cleanup, including both quality gates.
7. Implement the approved first batch in one coherent pass.
8. Focused tests -> full `pnpm check` -> commit/push -> one physical S22+ install/smoke.
9. Stop before redistributing individual diagnostics metrics; present the cleaned surface to the user for the next design decision.
