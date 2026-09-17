# Next chat handoff — Plug/Thermometer architecture re-audit

Updated: 2026-09-17

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Branch and Local Agent

Continue only on:

```text
work/plug-screen-automation-entry-20260917
```

Local Agent Chat Bridge binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

Control branch:

```text
agent-control
```

Daemon verified during the audit:

```text
daemon_version 4.18.22
repository MichalMatu/local-climate-link-starter
binding e75c77cb-7589-4452-94b2-decc97ff85a1
```

Managed workspace verified read-only:

```text
/Users/michal/agent-workspace/repos/local-climate-link-starter/work
remote https://github.com/MichalMatu/local-climate-link-starter.git
```

The Local Agent uses its managed local branch `agent-work` tracking the requested remote work branch. At the start of the re-audit the workspace was clean and both local HEAD and `origin/work/plug-screen-automation-entry-20260917` were exactly:

```text
8b5044cb7d653f38681c8c12315ff9ad593ba256
Refresh next chat handoff
```

`origin/main` / merge-base was:

```text
0ad9595b6d1b9a1db69b5a616a5f17932c424ee7
Document preferred Wi-Fi ADB workflow
```

The full audited range was 20 commits / 34 changed files ahead of `main`, not merely the last commit.

## Product-code checkpoint

The last product-code SHA built and installed on the physical Samsung S22+ remains:

```text
19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac
Compact thermometer card details
```

Its direct child `8b5044cb...` was documentation-only. The re-audit then updated architecture/product/UX documentation in:

```text
6f31eb8009c4dfc5f27f122150169d90401f9581
Refresh architecture and product audit docs
```

The commit containing this handoff is also documentation-only. No application behavior was changed by the re-audit.

## Product model — keep frozen unless explicitly re-decided

Bottom navigation:

```text
Plugs | Thermometers | Settings
```

Accepted ownership model:

```text
physical Plug -> zero or one installed automation for that relay
```

Keep all of these decisions:

- `+` on Plugs adds a physical Plug,
- automation entry belongs to a concrete Plug,
- Time is a Plug automation type, not a global Time section,
- `InstalledAutomation` remains the durable automation entity/source of installed automation truth,
- a plain saved Plug remains useful after automation removal,
- both phone BLE and Shelly-side BLE discovery save into the same sensor draft/readings model,
- user Plug name is separate from hardware identity (`model` + `gen`),
- do not introduce a global Rules/automation ownership store without a concrete requirement.

## Read-only architecture re-audit — completed

The requested preimplementation audit is complete. It compared the whole branch to `main`, inspected current responsibility boundaries and ran read-only Local Agent checks.

### What remains well separated

- `useShellySetupScanFlow.ts` cleanly owns LAN scan state, progressive results and cancellation.
- `useShellyBleDiscoveryFlow.ts` cleanly owns temporary Shelly BLE-discovery lifecycle/cleanup.
- `usePhoneSensorFlow.ts` cleanly owns phone BLE scan/live scan/GATT coordination and feeds the shared sensor readings/store path.
- `sensorReadingsStore.ts` remains the one per-sensor reading source for both discovery paths.
- `setupDraftStore.ts` still owns setup inputs + saved Plug/Sensor metadata and has not become an automation ownership registry.
- the installed automation path in `flows/installations/*` retains the accepted exact-script and runtime AUTO/MANUAL safety semantics.
- setup pages continue to depend on narrow page contracts rather than importing low-level Shelly/BLE transports.

### Concrete architectural debt/regression

#### 1. `ShellySetupPage.tsx`

The page is not a transport god object, but it now composes four distinct UI tasks:

- Add Plug/manual entry,
- LAN scan/results,
- concrete Plug settings,
- Shelly BLE discovery.

Read-only line count: about 810 lines. `pnpm quality:repo` reports 811 against the 700-line responsibility budget.

Recommended cleanup: behavior-preserving extraction of cohesive modal/presentation units only. Keep one discriminated dialog state and the existing flow/hook ownership.

#### 2. `SensorSetupPage.tsx`

Phone BLE/live lifecycle is correctly outside the page, but the saved thermometer card is now a distinct presentation unit with name/source/actions, metrics, status strip and Details.

Read-only line count: about 690 lines. `pnpm quality:repo` reports 691 against the 650-line responsibility budget.

Recommended cleanup: extract a focused saved-sensor card component. This is also the clean boundary for the next thermometer leading-icon/sample-pulse UX.

#### 3. legacy duplicate AUTO/MANUAL RPC path

This is the most important semantic debt found.

The accepted `InstalledAutomation` runtime path changes AUTO/MANUAL inside the running managed script and verifies exact ownership. Generic hardware setup still exposes older `setAutomationAuto` / `setAutomationManual` actions from `useShellyControlFlow`, wired by `SavedShellyDeviceCard`, and those call `Script.Start` / `Script.Stop`.

Do not extend this legacy path. Generic Shelly control should eventually be narrowed to physical status/direct relay control; installed automation control belongs in `flows/installations/*`.

Do not confuse this with temporary BLE-discovery cleanup, where stop/restart is intentional lifecycle behavior.

#### 4. `AutomationDashboardScreen.tsx`

Current size is about 579 lines. Do not split it for line count alone.

Two real seams exist if/when the screen is next changed:

- saved Plug -> `InstalledAutomation` reconciliation currently lives inline and can become a small pure selector/helper,
- `PlainPlugCard` can be extracted if doing so removes duplicated physical-control state or makes a concrete change safer.

Do not create a second ownership store to solve this.

#### 5. test coupling

Most tests remain user-behavior oriented, but some assertions depend on implementation classes such as `.status-stack`, `.sensor-setup-panel--embedded`, `.demo-panel` and exact DOM/icon class structure. Replace these opportunistically with accessible/user-visible contracts when those tests are touched; do not rewrite large test files solely for line count.

### `useHardwareSetupFlow.ts`

Current read-only line count: about 586; budget is 650.

It remains a composing facade, but docs must describe it accurately: it still contains a small residual setup/script orchestration cluster (`check/recheck`, `setupStatus`, load/delete setup script). Those responsibilities predate this branch and did not regrow during the Plug/Thermometer pass. Do not extract them during unrelated UX work.

## Quality-gate result from the audit

Read-only Local Agent execution of:

```bash
pnpm quality:repo
```

currently fails exactly the two composition budgets relevant to this pass:

```text
ShellySetupPage.tsx 811 > 700
SensorSetupPage.tsx 691 > 650
```

Do **not** raise the budgets. The audit found real extraction boundaries for both files.

Other inspected flow sizes remain below their architecture budgets:

```text
useHardwareSetupFlow.ts       586
useShellySetupScanFlow.ts      84
useShellyControlFlow.ts       290
useShellyBleDiscoveryFlow.ts  177
usePhoneSensorFlow.ts         264
setupDraftStore.ts            341
```

No full `pnpm check:full` or new physical QA was claimed during this docs/read-only audit.

## Documentation updated by this audit

Read before continuing:

- `docs/architecture/refactor-boundaries.md`
- `docs/product/next-functional-steps.md`
- `docs/ux-polish-backlog.md`

They now reflect the Plug-centric product model and the audit findings above. Old roadmap wording that treated `Klimat / Czas / Ustawienia` or expanded LED settings as the immediate next task is no longer current.

## Recommended next decision

Before adding more UX, decide whether to first execute the two small behavior-preserving presentation extractions that restore `pnpm quality:repo` headroom. They are justified by real responsibility boundaries, not file size alone.

Keep the legacy generic Shelly AUTO/MANUAL cleanup as a separate semantic slice; do not hide it inside a visual refactor.

## Nearest already-agreed UX slice

After the audit/cleanup boundary is accepted, the next small UX task remains:

> Add a Tabler thermometer/temperature icon to the upper-left of each saved thermometer card, aligned analogously to the Plug icon. When a genuinely newer BLE sample arrives, the icon may briefly turn blue and then return to normal.

Fresh-sample semantics are already determined:

- use the existing sensor sample's `seenAtMs`,
- a new event means `seenAtMs` strictly advances for that sensor,
- do not pulse on mount, rerender or tab switch,
- do not use global saved-scan `updatedAtMs` as per-sensor freshness,
- do not add a new store or second domain freshness state.

The preferred implementation boundary is the focused saved-sensor card component described by the audit.

## Process guardrails

- continue on `work/plug-screen-automation-entry-20260917`,
- use the Local Agent Chat Bridge with the exact binding above,
- before any new Local Agent task read `.agent/status/daemon.json`,
- do not edit the same work branch while a Local Agent task is active,
- work in small slices,
- do not refactor working architecture speculatively,
- preserve `InstalledAutomation` ownership and runtime safety,
- after real code changes run focused tests/checks appropriate to scope and restore `pnpm quality:repo`,
- when a UX slice is complete, build/install on the S22+ and visually verify before calling it accepted.
