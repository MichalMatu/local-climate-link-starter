# UX polish backlog

Updated: 2026-09-17

This backlog reflects the current **Plugs | Thermometers | Settings** product model. Completed work is recorded as baseline; only real follow-ups remain here.

## Completed current baseline

The active Plug/Thermometer pass already includes:

- Plug-centric dashboard and automation entry,
- Time moved under a concrete Plug instead of a global dashboard section,
- physical Plug cards with editable names, live telemetry, direct ON/OFF, settings and `Dodaj automatykę`,
- compact concrete Plug settings with duplicated rows removed,
- LAN scan full-range/progressive-result behavior with one Start/Stop button,
- Shelly-side BLE thermometer discovery using the existing discovery flow/store,
- **Thermometers** bottom-navigation surface using the existing sensor setup flow in embedded mode,
- flat thermometer list without the extra outer panel card,
- compact thermometer cards with large temperature/humidity, Tabler battery/RSSI/clock strip and closed Details disclosure,
- viewport-safe InfoTooltip bubbles,
- duplicate Plug-settings control-error toast suppression limited to that concrete context.

The exact product code physically installed on the Samsung S22+ is `19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac`.

## Immediate UX follow-up

### Thermometer leading icon and fresh-sample pulse

The next small visual slice is intentionally narrow:

- add a Tabler thermometer/temperature icon in the upper-left of each saved thermometer card,
- align icon/name/actions with the established Plug-card header rhythm,
- optionally turn the icon blue briefly only when the existing per-sensor latest sample timestamp becomes strictly newer,
- return to normal after the transient animation,
- do not pulse on mount, rerender, reopening the tab or merely because a BLE scan is running,
- do not create another store or another domain-level freshness state.

Prefer a focused saved-sensor card component so the pulse semantics stay with card presentation rather than increasing `SensorSetupPage` lifecycle responsibilities.

Use Tabler icons only; do not introduce emoji or custom SVG icons.

## Architecture cleanup that should precede/contain further polish

The read-only re-audit found two real composition seams:

- `ShellySetupPage.tsx` now combines Add Plug, LAN scan, concrete Plug settings and Shelly BLE presentation and exceeds its repository budget,
- `SensorSetupPage.tsx` now combines setup/scan composition with an increasingly substantial saved thermometer card and exceeds its repository budget.

Use behavior-preserving component extraction at these seams. Do not create new stores/hooks merely to move lines.

The legacy generic Shelly AUTO/MANUAL control path is a separate semantic cleanup; do not hide it inside a visual refactor.

## Test polish

New tests are mostly behavior-oriented, but some assertions intentionally or accidentally depend on implementation classes such as `.status-stack`, `.sensor-setup-panel--embedded`, `.demo-panel` and exact icon DOM classes.

When those tests are touched:

- prefer roles, names, visible content/state and RPC effects,
- retain class assertions only when the class/layout itself is the product contract,
- keep explicit Tabler-only assertions where icon-system consistency is the intended contract,
- keep responsive overflow checks even though they necessarily inspect DOM geometry/classes.

Do not rewrite the large hardware scenario suite solely to make it shorter.

## Deferred UX follow-ups

- Further Plug settings restructuring requires a concrete management task; do not add another hierarchy just because the page is large.
- Technical identifiers such as IP and MAC stay in technical/device-detail contexts; normal cards should prefer saved human names.
- BLE scanning stays in the existing task/modal flow unless it genuinely grows into filtering, multi-select, persistent scan results or richer device details.
- Expanded Shelly LED controls remain a later product slice, not part of the current thermometer polish.
- VPD algorithm/default/range changes remain out of scope until a dedicated runtime/algorithm audit.

## CSS/design guardrails

- Keep using existing spacing/color/radius tokens.
- Keep Tabler as the icon system.
- Similar Plug/Thermometer header geometry is desirable, but do not invent a generic component until there is actual reusable semantics.
- Avoid broad CSS rewrites during small UX slices.
- Remove dead/empty selectors opportunistically when touching the same stylesheet.

## General guardrails

- Preserve useful data unless it is genuinely duplicated.
- Keep transient progress inside the active task surface; use global toasts only where feedback remains relevant after the task closes.
- Avoid nested modals for one logical task.
- Preserve automation/runtime safety during visual cleanup.
- Prefer small isolated changes with focused checks.
- Treat architecture line budgets as regression alarms, not goals or numbers to raise.
