# Local Climate Link — next functional steps

Updated: 2026-09-19

## Current checkpoint

Product-code baseline:

```text
965618b0023946a16acee6dc46a33eea9be7df50
Stabilize BLE child-page cleanup callback
```

The standalone Plug/Thermometer add-page refactor and the remaining-screen UX consistency audit are both closed at this checkpoint.

Validation on the current code passed focused checks and one full `pnpm check` with no lint warnings. Android alpha build also succeeds. Physical Samsung S22+ install/cold-start smoke is still outstanding only because ADB reported zero authorized devices during the latest attempt.

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
- the phone configures and diagnoses, but does not become the runtime automation owner.

## Completed UX consistency work

Keep these decisions unless evidence requires change:

- full working surfaces use the page tree rather than modal shells;
- saved Plug settings are a child page;
- saved Plug BLE discovery is a deeper child page;
- configurator saved-Shelly settings and BLE discovery follow the same page hierarchy;
- shared child-page back chrome uses `AppPageBack`;
- missing Installation states use the same back chrome;
- rule advanced settings are inline; the obsolete advanced-settings modal was deleted;
- transient confirmation/error/picker/preview surfaces may remain modals;
- the standalone Add Plug/Add Thermometer screens remain frozen unless a regression is found.

The Shelly BLE child page now safely cleans up a scanner even when the user presses Back while scanner startup/upload is still in progress.

## Next phase: explicit product work

Do not start another repository-wide or screen-wide UX sweep by default. Select the next slice from a concrete product requirement or observed regression.

Likely product categories include:

- richer Plug management/configuration;
- additional sensor/device profiles;
- additional Plug-owned automation types;
- targeted usability polish on a specific screen with observed friction.

Any new work must preserve the Plug-owned automation model and one-runtime-owner rule.

## Architecture work: only when the next feature touches it

Do not start a broad cleanup project now. Current architecture and UX gates pass.

Use the watchlist in `docs/architecture/refactor-boundaries.md` when the next feature requires related changes. In particular:

- split `hardware-setup.test.tsx` by cohesive scenario only when materially extending it;
- extract feature-cohesive CSS when touching a screen with stale/global selector pressure;
- keep `ShellySetupPage` and `shellyRequests.ts` from absorbing unrelated responsibilities;
- keep `useHardwareSetupFlow` as a facade over focused flows;
- keep the current line budgets rather than raising them to land a change.

## Native validation follow-up

When the Samsung S22+ is visible to ADB again, complete the pending alpha install/cold-start smoke for the current checkpoint:

- install current alpha build;
- verify `versionName=2.0.10` and `versionCode=20010` unless the version changed intentionally;
- cold-start the app;
- confirm `MainActivity` is top-resumed;
- confirm no app FATAL/ANR.

Device absence is not a product-code failure and does not block unrelated TypeScript/web work.

## Verification discipline

For each implementation slice:

1. fetch fresh branch + Local Agent daemon;
2. do a bounded preimplementation audit first;
3. implement the smallest cohesive change;
4. run focused typecheck/quality/tests;
5. run exactly one final full `pnpm check` on the successful iteration;
6. commit/push only green state;
7. perform physical S22+ smoke when the change affects native/device behavior or a UI interaction that merits device verification.

Hardware-mutating tests remain explicit and bounded. Preserve the existing safe relay/uninstall contracts.
