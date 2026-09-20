# Local Climate Link — next functional steps

Updated: 2026-09-20

## Current checkpoint

Latest verified app-code baseline:

```text
8ad5b152bdbf861a8e6620414245dfbcb06c0ead
Anchor app toasts above bottom navigation
```

Documentation commits follow this app-code checkpoint on the active work branch; always fetch the fresh branch before work.

The standalone Plug/Thermometer add-page refactor, remaining-screen UX consistency audit, targeted UI-polish slice and toast-host hardening are closed at this checkpoint.

Validation on the app code passed focused checks, responsive toast geometry coverage and one full `pnpm check`. The toast regression is now protected by an app-shell portal contract and `quality:ux`, so page surfaces cannot silently trap fixed toasts again.

Do not spend the next iteration reopening completed UX surfaces unless a concrete regression is observed.

## Stable product model

- bottom navigation: **Plugs | Thermometers | Settings**;
- a physical Plug is the automation anchor;
- `+` on Plugs adds a Plug;
- `+` on Thermometers adds a Thermometer;
- a plain Plug remains manageable/useful without automation;
- Time is a Plug automation type;
- climate automation runs locally on Shelly after installation;
- `InstalledAutomation` is the durable automation entity;
- user display names remain separate from hardware identity;
- the phone configures and diagnoses, but does not become the runtime automation owner;
- `AppShell` owns persistent bottom navigation and global toast geometry.

## Completed UX consistency and polish work

Keep these decisions unless evidence requires change:

- full working surfaces use the page tree rather than modal shells;
- saved Plug settings are a child page;
- saved Plug BLE discovery is a deeper child page;
- configurator saved-Shelly settings and BLE discovery follow the same page hierarchy;
- shared child-page back chrome uses `AppPageBack`;
- missing Installation states use the same back chrome;
- rule advanced settings are inline; the obsolete advanced-settings modal was deleted;
- transient confirmation/error/picker/preview surfaces may remain modals;
- the standalone Add Plug/Add Thermometer screens remain frozen unless a regression is found;
- Plug names are editable consistently from the main card and detail surface;
- Thermometer card hardware metadata is a quiet one-line footer below the existing separator rather than an expandable `Details` section;
- rule threshold pairs auto-repair only invalid pairs, while valid narrower hysteresis is preserved;
- shared modal geometry is content-driven up to a common max height;
- major surfaces use restrained glass styling without moving geometry-critical overlays inside filtered containers.

The Shelly BLE child page safely cleans up a scanner even when the user presses Back while scanner startup/upload is still in progress.

## Global toast contract

All mobile toast visuals still come from the shared `@lcl/ui` `ToastViewport`, but mobile screens render through `AppToastViewport` into the shell-owned `#app-toast-host`.

Do not:

- render raw `<ToastViewport>` inside `apps/mobile/src/screens/**`;
- add page-specific toast `bottom` values;
- move the toast host into a card, `.demo-panel`, transformed container or filtered glass surface.

The shell-level offset keeps toasts directly above the persistent bottom navigation and safe area. `quality:ux` and responsive E2E protect this contract across phone, tablet and desktop viewports.

## Next phase: explicit product work

Do not start another repository-wide or screen-wide UX sweep by default. Select the next slice from a concrete product requirement or observed regression.

Likely product categories include:

- richer Plug management/configuration;
- additional sensor/device profiles;
- additional Plug-owned automation types;
- targeted usability polish on a specific screen with observed friction.

Any new work must preserve the Plug-owned automation model, one-runtime-owner rule and shell-owned overlay geometry.

## Architecture work: only when the next feature touches it

Do not start a broad cleanup project now. Current architecture and UX gates pass.

Use the watchlist in `docs/architecture/refactor-boundaries.md` when the next feature requires related changes. In particular:

- split `hardware-setup.test.tsx` by cohesive scenario only when materially extending it;
- extract feature-cohesive CSS when touching a screen with stale/global selector pressure;
- keep `ShellySetupPage` and `shellyRequests.ts` from absorbing unrelated responsibilities;
- keep `useHardwareSetupFlow` as a facade over focused flows;
- keep the current line budgets and UX gates rather than weakening them to land a change.

## Native validation policy

A physical Samsung S22+ install/cold-start smoke succeeded for the preceding glass/modal polish build. The user may disconnect the phone during autonomous work; that must not block unrelated TypeScript/web/UI validation.

When native verification is useful:

- use the existing Android `medium_phone` AVD when a physical device is unavailable and the AVD actually reaches ADB `device` state;
- if the local AVD does not boot, use responsive Playwright only for layout/web-shell evidence and record native smoke as unverified rather than treating the emulator failure as an app failure;
- clearly distinguish Playwright, emulator and physical-device evidence;
- verify `versionName=2.0.10` / `versionCode=20010` unless intentionally changed;
- cold-start `MainActivity`;
- confirm the app process is alive and no app FATAL/ANR is present;
- capture a screenshot when validating layout/chrome;
- use physical hardware only for behavior the emulator cannot meaningfully reproduce, such as real BLE/radio/device interaction.

## Verification discipline

For each implementation slice:

1. fetch fresh branch + Local Agent daemon;
2. do a bounded preimplementation audit first;
3. implement the smallest cohesive change;
4. run focused typecheck/quality/tests;
5. run exactly one final full `pnpm check` on the successful iteration;
6. commit/push only green state;
7. use emulator or physical-device smoke when the change affects native/UI behavior enough to merit it;
8. remove temporary screenshot/build branches after validation evidence has been recorded.

Hardware-mutating tests remain explicit and bounded. Preserve the existing safe relay/uninstall contracts.
