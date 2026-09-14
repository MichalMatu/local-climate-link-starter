# Local Climate Link — UX restoration handoff

Updated: 2026-09-14

## Start here

Work only in `MichalMatu/local-climate-link-starter` with Local Agent binding `e75c77cb-7589-4452-94b2-decc97ff85a1`.

Active implementation branch: `work/device-rule-decoupling-20260913`.
The last product/code checkpoint before this documentation-only cleanup is `0fbe83040ae0e41f932bb83a65a8b3438c26ba1b`.
Do not merge to `main` automatically.

## Goal for the next chat

Restore the **accepted v2.0.10 visual UX and interaction quality** while keeping the new independent Plug / Thermometer / Rule architecture and all useful new behavior.

This is not a rollback of the refactor. Preserve the new registries, rule ownership, lifecycle, deployment safety, LAN scan, device/rule independence, rule usage information, orphan-resource handling and current schedule logic. Reuse the old visual hierarchy, card composition, spacing, typography, menus and progressive disclosure as the reference surface, then fit the new logic into that design.

## Canonical old UX reference

Accepted application baseline (do not move):

- tag: `stable-20260912-v2.0.10-ux-polish`
- application SHA: `8173f0851adc77222fc3e98b02113ff28f7119fd`
- later `main` application tree before screenshots: `56a90240029ce19690e96ad02057cc4150ba537f` (the intervening commits were documentation / `.gitignore` only)

Fresh physical Samsung SM-S906B reference capture is committed on `main` at `a625d57422d39dbb9acc603c9a8943bf4ef3fec5`:

`artifacts/ux-reference/main-20260914/`

The Android folder contains 19 screenshots plus matching `.txt` DOM/body snapshots. Use these files as the visual source of truth instead of reconstructing the old UX from memory.

Key captures:

- `01-dashboard-climate.png`
- `02-climate-detail.png`
- `03-climate-detail-expanded.png`
- `04-settings.png` / `05-settings-expanded.png`
- `06-dashboard-time.png`
- `07-time-setup-shelly.png` / `08-time-add-plug.png`
- `09-time-schedule.png` / `10-time-wheel-picker.png`
- `11-setup-intent.png`
- `12-climate-setup-shelly.png` / `13-climate-add-plug.png`
- `14-climate-setup-sensors.png` / `15-add-thermometer.png`
- `16-climate-setup-rule.png` / `17-climate-rule-expanded.png`
- `18-rule-advanced-modal.png`
- `20-developer-diagnostics.png`

Old `artifacts/ui-audit/physical-20260910` captures were removed so there is one canonical physical reference set. Play Store assets were intentionally left alone because they are release assets, not audit history.

## Current architecture that must remain

- Plug, Sensor and Rule are independent durable entities (`lcl.plugs.v1`, `lcl.sensors.v1`, `lcl.rules.v1`).
- A sensor is global; durable sensor↔plug association exists only through a climate rule.
- Exactly one rule may own `(plugId, relayId)`.
- Rule and device names are independent.
- Climate AUTO/MANUAL is canonical in-process `R.m`; normal mode changes never stop/start the managed script.
- Unknown runtime mode fails closed.
- BLE discovery keeps the climate runtime alive in MANUAL/OFF, cleans up discovery, then restores the exact previous mode; it never guesses AUTO.
- Time rules own native Shelly schedules. Climate active hours stay in the climate script.
- Direct relay control is allowed only when ownership is known and unclaimed.
- Runtime mutation verifies exact physical/rule/script/schedule ownership and uses OFF-first safety.

Canonical technical docs: `docs/adr/ADR-0006-independent-devices-and-rules.md`, `docs/architecture/refactor-boundaries.md`, and `docs/architecture/runtime-control.md`.

## Current verification

At `0fbe83040ae0e41f932bb83a65a8b3438c26ba1b`:

- focused device UX regression E2E: 3/3 pass,
- full responsive E2E: 10/10 pass,
- `pnpm check:full`: pass,
- Android build/install/cold start on Samsung SM-S906B: pass, no fatal exception.

The old `main` build is currently the visual reference; do not infer current implementation quality from it.

## First next-chat task

Compare the current work-branch screens against the physical reference images **screen by screen**, starting with dashboard/device cards and menus. Make small reviewable visual changes, preserving current business logic. After each small UX batch run focused checks; run full `check:full` and Android acceptance only at the end of an iteration.
