# Local Climate Link — next chat handoff

Updated: 2026-09-17

This is the canonical continuation handoff for the current Plug/Thermometer product pass. Read it completely before changing code.

## First action in the next chat

Do **not** start by implementing another UI change.

First perform a read-only re-audit of the current work branch against `main` focused on code cleanliness, responsibility boundaries, duplicate state/RPC paths, page/component size and documentation drift. The audit must not change product behavior. After the audit, update the durable architecture/product documentation to match the code, then continue the pending thermometer-card polish as a small isolated change.

Recommended audit sequence:

1. read `AGENTS.md` and this file,
2. read `.agent/status/daemon.json` on `agent-control`,
3. verify the exact remote/workspace SHA and clean working tree,
4. inspect `main..work/plug-screen-automation-entry-20260917`, not only the latest commit,
5. re-read `docs/architecture/refactor-boundaries.md`, `docs/product/next-functional-steps.md` and `docs/ux-polish-backlog.md`,
6. identify any responsibility creep before editing,
7. update those docs where the 2026-09-17 product model has made them stale,
8. only then implement the remaining thermometer-card icon/live-update polish.

## Hard repository binding and execution model

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- active work branch: `work/plug-screen-automation-entry-20260917`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`
- Local Agent daemon observed during handoff: `4.18.22`

Every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

ChatGPT plans; Local Agent executes deterministic local/build/device commands. Never ask Local Agent to invoke Codex. Before editing the work branch, verify daemon state and exact SHA. Task ids/payloads are immutable. Do not edit the same branch while another task is active.

## Git state at handoff

Canonical `main` is still:

```text
0ad9595b6d1b9a1db69b5a616a5f17932c424ee7
Document preferred Wi-Fi ADB workflow
```

The active product branch is 19 commits ahead of that base. The exact **product-code SHA currently built and installed on the physical phone** is:

```text
19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac
Compact thermometer card details
```

This handoff update is documentation-only and will sit after that product SHA on the work branch. When validating behavior, distinguish the installed product SHA above from the later handoff-doc commit.

Do not merge this branch to `main` until the current Plug/Thermometer UX pass and re-audit are accepted.

## Physical Android QA state

Physical device: Samsung Galaxy S22+ / `SM-S906B`, package `link.localclimate.app`.

The exact product SHA `19bbd0cc...` was built, synced to Android, assembled and installed non-destructively with `adb install -r`; the Local Agent install task finished successfully. Existing app data was preserved.

Preferred deployment:

- use Wi-Fi ADB when it is available,
- USB ADB is the reliable fallback,
- use `adb install -r` to preserve app/localStorage data,
- do **not** use destructive install flows such as `pnpm android:phone-alpha` for ordinary QA.

Physical Shelly used during this pass is reachable at `192.168.0.10`. ADB debugging previously confirmed phone-to-Shelly reachability, TCP/80 and a valid `Shelly.GetDeviceInfo` response.

## Product model agreed during the 2026-09-17 pass

The primary mental model is:

```text
physical Plug -> control method / automation
```

not a new global `Plug -> Sensor -> Rule -> ownership registry` domain.

Keep these decisions:

- bottom navigation is **Plugs | Thermometers | Settings**,
- Time is no longer a global dashboard section; it is an automation type added to a specific Plug,
- `+` on Plugs adds a physical plug,
- automation setup starts from a concrete plug and should keep that plug context,
- `InstalledAutomation` remains the durable automation entity,
- do not add an independent global Rules surface or duplicate ownership model without a concrete requirement,
- thermometers discovered by phone BLE and by a Shelly-side BLE scan persist into the same sensor store,
- user display name is separate from Shelly hardware identity (`model` + `gen`).

Future support such as Shelly Smart Lead Gen4 should build on the stored hardware identity, not on hard-coded Plug S Gen3 labels or user names.

## Completed Plug/dashboard work on the active branch

The current work branch includes the following accepted direction:

- Plugs are the main dashboard entities; an unconfigured plug stays useful after automation removal,
- plain Plug cards have editable user names, `...` device settings, live electrical telemetry, ON/OFF and `Dodaj automatykę`,
- climate cards preserve their stronger live automation presentation,
- global Time navigation was replaced with Thermometers,
- visible giant `Gniazdka` / `Termometry` page headings were removed because bottom navigation already gives location context,
- Thermometers no longer render an outer card around the individual sensor cards,
- the round bottom-right FAB pattern is shared by Plugs and Thermometers.

### Plug details/settings

The concrete Plug `...` opens physical Shelly settings. The details surface was simplified into one compact list rather than two nested/duplicated cards.

Current intended order:

1. hardware model/gen + compatibility badge,
2. IP address (single occurrence),
3. firmware,
4. Wi-Fi RSSI,
5. uptime,
6. NTP sync state + timestamp in one row,
7. Scripts,
8. Bluetooth,
9. Matter.

Removed as redundant from this details surface:

- duplicate IP,
- Relay ON/OFF,
- automation Mode,
- separate Clock synced row,
- repeated Shelly/device name,
- second capabilities card.

Saved Shelly metadata now includes optional `model` and `gen`; old stored devices remain compatible and metadata is hydrated after successful reads.

Plug settings also expose:

- `Skanuj termometry BLE przez to gniazdko`, using the existing Shelly BLE discovery flow,
- remove only from the app, using existing confirmation semantics.

Do not create a second BLE scanner/store for this path.

## LAN Shelly scanner state

The LAN scanner regression found during this pass is fixed.

Important semantics:

- full-range scan continues after finding a device,
- already-saved Shelly devices are still displayed and marked as already added,
- results are published progressively while the scan continues; they are not held until all worker promises finish,
- discovered devices appear above the compact scan-progress row,
- the progress row no longer occupies a large blank block,
- Start/Stop is one stateful button: **Start scan** when idle, **Stop scan** while running.

Do not regress progressive result publication while refactoring `useShellySetupScanFlow.ts`.

## Feedback/tooltip fixes already made

- shared `InfoTooltip` bubbles are viewport-width constrained globally so BLE/network help does not overflow the phone screen,
- concrete Plug settings suppress only the duplicate transient control-error toast for that exact device while retaining the persistent inline warning,
- other toast contexts remain unchanged.

## Thermometer dashboard/card state at product SHA 19bbd0cc

The dashboard Thermometers surface uses the existing sensor setup flow in embedded mode; the outer `demo-panel` card is removed while normal hardware-setup contexts keep their existing panel.

The saved thermometer card now has:

- editable sensor name and existing source/action icons,
- large Temperature and Humidity values,
- one compact status strip using **Tabler icons only**:
  - `IconBattery` + battery percentage/voltage,
  - `IconWifi` + RSSI,
  - `IconClock` + last reading time,
- a native `<details>` disclosure labelled `Szczegóły`, closed by default,
- sensor Type and MAC inside the disclosure.

MAC intentionally remains available in Details. It is not useful enough for the always-visible card, but it is useful for identifying identical sensors, BLE debugging and later automation assignment.

The product SHA was validated through the mobile test command, mobile build and UX quality gate before commit, and then installed on the physical S22+.

## Immediate pending UX item — not yet implemented

The latest user request is to make the thermometer card header visually match the Plug card:

- add a **Tabler thermometer/temperature icon** at the upper-left of each thermometer card,
- align icon/name/actions so the card header follows the same spatial rhythm as Plug cards,
- when a genuinely fresh BLE reading arrives, the thermometer icon may turn blue briefly and then return to normal,
- use Tabler icons only; do not introduce emoji/custom SVG icons.

Before implementing the blue pulse, define the event semantics cleanly. Prefer reacting to a real change in the latest sample identity/timestamp rather than turning blue merely because the component mounted or re-rendered. Keep this visual-only; do not create a second sensor freshness state/store.

## First re-audit targets

The branch is 19 commits / roughly 33 changed files ahead of `main`, so do a focused architecture hygiene pass before more feature work. In particular inspect:

### `AutomationDashboardScreen.tsx`

It has accumulated Plug mapping, plain Plug card UI, automation cards, settings overlay and Thermometer embedding. Decide whether responsibilities are still cohesive. Extract only where there is a real boundary; do not split for line count alone.

### `ShellySetupPage.tsx`

The 2026-09-17 diff grew substantially because one page now serves add flow, LAN scan, concrete Plug settings and Shelly-side BLE scanning. Verify that transport/state still live in flows/hooks and that page composition has not become a new god object.

### `SensorSetupPage.tsx`

Re-check separation between phone BLE task UI, saved-card presentation, rename/delete actions and sensor-flow orchestration. The new compact status/detail presentation should remain presentation-only.

### Flow/store boundaries

Re-audit:

- `useHardwareSetupFlow.ts` remains a composing facade,
- `useShellySetupScanFlow.ts` owns LAN scan lifecycle/progressive results/cancellation,
- `useShellyControlFlow.ts` owns direct relay/status control,
- `useShellyBleDiscoveryFlow.ts` owns Shelly-side BLE discovery,
- `usePhoneSensorFlow.ts` owns phone BLE sensor work,
- `setupDraftStore.ts` owns saved Plug/Sensor draft metadata without becoming an automation ownership registry,
- feedback hooks own transient notification lifecycle, not domain behavior.

### CSS/test growth

Check whether the dashboard/theme CSS additions duplicate patterns that should use existing project primitives/tokens. Check that tests protect behavior/UX contracts without overfitting internal class names.

Use repository quality budgets as alarms, not refactor targets.

## Documentation that is now stale and must be refreshed after the audit

The older 2026-09-12 docs still describe the pre-Plug-centric dashboard and old next-work priority. Reconcile at least:

- `docs/architecture/refactor-boundaries.md`,
- `docs/product/next-functional-steps.md`,
- `docs/ux-polish-backlog.md`,
- this `docs/HANDOFF_NEXT_CHAT.md` if the audit changes any conclusion.

Do not create another competing handoff/TODO document unless these canonical files genuinely cannot represent the information.

## Runtime invariants that must not regress

### AUTO

- exact managed climate script remains running,
- BLE runtime and diagnostics remain live,
- automatic relay decisions are allowed.

### MANUAL

- exact managed climate script remains running,
- BLE/runtime diagnostics remain live,
- automatic output decisions are blocked inside the generated runtime,
- direct phone ON/OFF is allowed only after verified MANUAL ownership/capability.

### STOPPED / MISSING

These are maintenance/failure states, not aliases for MANUAL. Normal AUTO/MANUAL switching must not use `Script.Stop`/`Script.Start`.

Mutation safety and exact runtime identity checks from the existing architecture must stay intact. Device UI refactors must not bypass automation ownership/safety behavior.

## Validation expectations for continued work

For small UI slices, at minimum run the focused/full mobile tests used by the affected area, mobile build, `pnpm quality:ux` and `git diff --check` before commit. For architecture/refactor closure, also run repository quality checks and the broader project validation appropriate to the touched scope.

Do not claim the current work branch has passed a new full release freeze unless `pnpm check:full` (and physical QA where relevant) is actually rerun. The 2026-09-17 incremental commits have been validated slice-by-slice, not declared as a new release baseline.

## Change philosophy

- evidence-driven,
- small, clean, low-risk/high-gain changes,
- no god objects,
- no duplicate state/RPC paths,
- preserve runtime safety semantics,
- prefer existing device-native Shelly APIs and existing flows/stores,
- keep normal user UI calm and move technical detail behind progressive disclosure,
- use the existing design tokens and Tabler icon system,
- keep changes visually coherent across Plug and Thermometer cards.
