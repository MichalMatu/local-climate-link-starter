# Local Climate Link — next functional steps

Updated: 2026-09-19

## Current checkpoint

Product-code baseline:

```text
2b0c045a16a1bc974191701fc73b05f054e65023
Polish discovery scan controls
```

The Plug/Thermometer standalone add-page refactor is closed. It passed focused checks, one full `pnpm check`, push and physical Samsung S22+ install/cold-start smoke.

Do not spend the next iteration reopening those two screens unless a concrete regression is observed.

## Stable product model

- bottom navigation: **Plugs | Thermometers | Settings**;
- a physical Plug is the automation anchor;
- `+` on Plugs adds a Plug;
- `+` on Thermometers adds a Thermometer;
- a plain Plug remains manageable/useful without automation;
- Time is a Plug automation type;
- climate automation runs locally on Shelly after installation;
- `InstalledAutomation` is the durable automation entity;
- user display names remain separate from hardware identity.

## Next phase: remaining-screen UX consistency

Before implementing anything, inspect the remaining screens on current code and on the S22+ where useful. Select **one** bounded surface per pass.

Prioritize concrete inconsistencies such as:

- substantial working content still trapped in a modal,
- duplicate navigation/header chrome,
- page containers that still look like stretched modal cards,
- nested/card-in-card surfaces without semantic value,
- inconsistent action placement or sizing,
- read-only technical data styled as editable fields,
- scroll behavior that competes with the persistent app shell,
- presentation code that owns network/BLE/runtime lifecycle.

Keep modal usage for decisions/confirmations. Preserve the `AppShell -> page -> child page -> decision modal` hierarchy.

## Completed device-add contract

Keep these decisions unless evidence requires change:

- discovery result cards share one visual grammar;
- display name is editable before save;
- identity/model are read-only text;
- `Add` remains compact and aligned with the name field;
- saving does not leave the add page;
- scan control remains below the results;
- active scan state is shown by an inline spinner inside the scan control;
- BLE scan auto-starts;
- Shelly LAN scan requires explicit start after range review.

## Architecture work: only when the next feature touches it

Do not start a broad cleanup project now. The current architecture gates pass.

Use the watchlist in `docs/architecture/refactor-boundaries.md` when the next screen requires related changes. In particular:

- split `hardware-setup.test.tsx` by cohesive scenario only when materially extending it;
- extract feature-cohesive CSS when touching a screen with stale/global selector pressure;
- keep `ShellySetupPage` and `shellyRequests.ts` from absorbing unrelated responsibilities;
- keep `useHardwareSetupFlow` as a facade over focused flows.

## Verification discipline

For each implementation slice:

1. fetch fresh branch + Local Agent daemon;
2. do a preimplementation audit first;
3. implement the smallest cohesive change;
4. run focused typecheck/quality/tests;
5. run exactly one final full `pnpm check` on the successful iteration;
6. commit/push only green state;
7. perform physical S22+ smoke when the change affects native/device behavior or a UI interaction that needs visual/device verification.

Hardware-mutating tests remain explicit and bounded. Preserve the existing safe relay/uninstall contracts.

## Later product work

After the remaining core screens are visually coherent, resume functional expansion from an explicit product requirement rather than speculative infrastructure. Likely categories include richer Plug management, additional device profiles and additional automation types, but none should bypass the Plug-owned automation model or create a second runtime owner.
