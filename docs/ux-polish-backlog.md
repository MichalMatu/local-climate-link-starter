# UX polish backlog

Updated: 2026-09-17

This backlog reflects the current **Plugs | Thermometers | Settings** product model after architecture cleanup commit:

```text
c67ac66c10e076e4b5d798e11bf117eefca49ea3
Tighten hardware setup boundaries
```

## Completed baseline

The current branch includes:

- Plug-centric dashboard and automation entry,
- Time attached to a concrete Plug rather than a global dashboard section,
- physical Plug cards with editable names, live telemetry, direct ON/OFF, settings and `Dodaj automatykę`,
- compact concrete Plug settings,
- LAN scan with full-range/progressive-result behavior,
- Shelly-side BLE thermometer discovery using the existing discovery flow/store,
- **Thermometers** bottom-navigation surface,
- compact saved thermometer cards with large temperature/humidity and battery/RSSI/last-seen details,
- viewport-safe tooltips,
- saved-sensor presentation extracted from `SensorSetupPage.tsx`,
- Shelly settings/BLE presentation split into focused modal boundaries,
- generic hardware-setup AUTO/MANUAL runtime controls removed.

Repository architecture budgets are back within gate. Final `pnpm check` passed, including 31/31 mobile test files and 171/171 tests.

The current branch code has not yet been installed on the physical Samsung S22+ because the phone became unavailable. The last physically installed product code remains `19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac`.

## Immediate UX follow-up

### Thermometer leading icon and fresh-sample pulse

This is now the next narrow implementation slice:

- add a Tabler thermometer/temperature icon in the upper-left of each saved thermometer card,
- align icon/name/actions with the established Plug-card header rhythm,
- briefly turn the icon blue only when the existing per-sensor latest sample `seenAtMs` becomes strictly newer,
- return to normal after the transient animation,
- do not pulse on mount, rerender, reopening the tab or merely because a BLE scan is running,
- do not create another store or domain-level freshness state.

The new `SensorSetupPresentation.tsx` boundary is the correct place for the presentation behavior. Keep radio lifecycle in `usePhoneSensorFlow` and sample semantics in `sensorReadingsStore.ts`.

Use Tabler icons only; do not introduce emoji or custom SVG icons.

## Architecture status

The earlier UX blocker is resolved:

- `ShellySetupPage.tsx` no longer needs to absorb every settings/BLE presentation concern,
- `SensorSetupPage.tsx` no longer owns the full saved thermometer card,
- repository line budgets were restored rather than increased,
- the old generic Shelly AUTO/MANUAL control path is gone from setup.

Do not add new stores/hooks merely to move presentation code around.

## Refresh behavior guardrail

A verification run caught an intermediate dashboard refresh loop caused by depending on an unstable mutation callback. The final implementation avoids that by tying refresh to physical Plug identity/address and using a ref for the latest refresh function.

For future card effects, keep event semantics explicit and avoid putting unstable mutation objects/functions directly into effects that perform network refreshes.

## Test polish

When tests are touched:

- prefer roles, accessible names, visible state and RPC effects,
- retain class/DOM assertions only where layout itself is the contract,
- keep explicit icon-system assertions where Tabler consistency is intended,
- keep responsive overflow checks where geometry is the product behavior.

Do not rewrite large scenario tests solely to make them shorter.

## Diagnostics/logging UX

Do not add a separate logging surface/module now.

Existing `@lcl/diagnostics`, runtime issue capture and support-report paths should be reused. After physical S22+ QA, add only concrete missing events proven useful by `adb logcat`/support evidence. Keep logs bounded and redacted.

## Physical QA pending

Once the phone is back:

- install the exact current branch build,
- visually smoke Plugs, Thermometers, Settings and Plug settings,
- inspect clean launch/navigation `adb logcat`,
- record any real layout/runtime issue before more polish.

Do not call the current branch a physically accepted baseline until that check is complete.

## Deferred UX follow-ups

- Further Plug settings restructuring requires a concrete management task.
- Technical identifiers such as IP/MAC stay in technical details; normal cards should prefer saved human names.
- BLE scanning stays in the existing task/modal flow unless it genuinely grows into a richer workflow.
- Expanded Shelly LED controls remain later work.
- VPD algorithm/default/range changes remain out of scope until a dedicated runtime audit.

## CSS/design guardrails

- keep existing spacing/color/radius tokens,
- keep Tabler as the icon system,
- reuse Plug/Thermometer header rhythm without inventing a generic component prematurely,
- avoid broad CSS rewrites during small UX slices,
- remove dead selectors opportunistically when touching the same area.

## General guardrails

- preserve useful data unless genuinely duplicated,
- keep transient progress inside the active task surface,
- avoid nested modals for one logical task,
- preserve automation/runtime safety during visual cleanup,
- prefer small isolated changes with focused checks,
- treat architecture budgets as regression alarms, not targets to raise.
