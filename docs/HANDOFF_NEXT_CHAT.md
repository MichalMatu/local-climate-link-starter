# Next chat handoff — Plug/Thermometer cleanup complete

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

Control branch: `agent-control`.

Managed workspace:

```text
/Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

## Current code checkpoint

Current product-code HEAD after architecture cleanup:

```text
c67ac66c10e076e4b5d798e11bf117eefca49ea3
Tighten hardware setup boundaries
```

Documentation then advanced the work branch to:

```text
c0fa5496a9ec64aa2b4bfb5634f8d42061096d84
Refresh UX backlog after cleanup
```

No product code changed between `c67ac66c...` and `c0fa5496...`.

The last build physically installed on the Samsung S22+ is still the older checkpoint:

```text
19bbd0ccf87f5490a216ca4ec302acf9c5b5a7ac
Compact thermometer card details
```

The phone was unavailable after the cleanup, so current code has **not yet** been installed or physically smoke-tested on the S22+. Do not claim physical QA until that is done.

## Prepared Android alpha artifact

Local Agent task `20260917-post-cleanup-android-build-v20` completed successfully without using ADB or requiring the phone.

The artifact was built from exact branch HEAD `c0fa5496...` using the normal mobile build, Capacitor sync and Gradle `assembleDebug` path.

```text
APK: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
size: 4.4 MB
APK SHA-256: cbee2239905cd46b3f989ffbcb262f9dfcf8282a32ab64f7884d46950ae935b7
alpha signer SHA-256: 2909c5fe69d075bde3f18d1f50608880b1c6b8041e08b11d37e9eb4942350b76
```

The APK signer exactly matched the existing alpha keystore fingerprint. The build left no tracked repository changes. Four updated documentation files also passed Prettier verification before the Android build.

When the phone returns, rebuild/install through the existing `pnpm android:phone-alpha` workflow rather than treating the local APK path as a permanent release artifact; that script intentionally performs the established clean alpha install and cold-start verification.

## Product model — keep stable

Bottom navigation:

```text
Plugs | Thermometers | Settings
```

Ownership model:

```text
physical Plug -> zero or one installed automation for that relay
```

Keep these decisions:

- automation entry starts from a concrete Plug,
- Time is a Plug automation type, not a global Time section,
- `InstalledAutomation` remains the durable installed-automation entity,
- `setupDraftStore.ts` remains setup/device metadata, not a second automation registry,
- a plain saved Plug remains useful for telemetry, direct relay control on the dashboard and later automation assignment,
- phone BLE and Shelly-side BLE discovery feed the same saved-sensor/readings model,
- user names are separate from hardware identity (`model` + `gen`).

## Architecture cleanup completed

Commit `c67ac66c...` resolves the concrete debt found by the 2026-09-17 re-audit without introducing new stores or transport layers.

### Presentation boundaries

- `SensorSetupPage.tsx` no longer owns the full saved-thermometer card presentation; that responsibility is moved to `SensorSetupPresentation.tsx`.
- Shelly setup modal/presentation responsibilities are split across the existing presentation layer, including focused `ShellySettingsModal.tsx` and `ShellyBleDiscoveryModal.tsx` boundaries.
- the empty `.sensor-setup-panel {}` selector was removed.
- repository architecture budgets were restored instead of raised.

### Generic Shelly runtime ownership

The legacy generic hardware-setup AUTO/MANUAL path was removed.

Generic Shelly setup no longer exposes `AUTO`, `MANUAL`, `ON`, `OFF` runtime automation controls and no longer owns the old `Script.Start` / `Script.Stop` mode switching path. Installed automation control remains under `flows/installations/*`, where the managed runtime stays authoritative.

Temporary script stop/restart that belongs specifically to Shelly BLE-discovery cleanup is unchanged and must not be confused with normal AUTO/MANUAL runtime control.

### Dashboard refresh regression caught during verification

An intermediate lint cleanup made `PlainPlugCard` refresh depend on an unstable mutation callback and caused `automation-dashboard.test.tsx` to grow until JS heap OOM. That change was rejected before commit.

The final implementation keeps refresh tied to physical target identity (`device.id` / `baseUrl`) while a ref provides the latest refresh function. The dashboard test then returned to normal execution.

## Verification completed on final code

Local Agent task `20260917-boundary-cleanup-code-v19` completed successfully on the exact final diff.

`pnpm check` passed before commit and again in the pre-push hook. In both complete runs the mobile suite reported:

```text
Test Files  31 passed (31)
Tests       171 passed (171)
```

The final verification also passed:

- formatting,
- lint,
- `quality:ux`,
- `quality:repo`,
- typecheck,
- workspace tests,
- core coverage gate,
- production build,
- `git diff --check`.

Earlier runner failures (`ERR_IPC_CHANNEL_CLOSED`, worker OOM, idle timeout) were investigated rather than accepted as product failures. The final `pnpm check` completed normally after fixing the real dashboard refresh loop.

## Diagnostics/logging decision

Do not create another logging module.

The repository already has:

- `packages/diagnostics` for bounded structured diagnostics/redaction/support export,
- `apps/mobile/src/app/runtimeDiagnostics.ts` for browser/WebView runtime errors and unhandled rejections.

If physical `adb logcat` later shows missing evidence, add only small structured events through these existing boundaries. Do not add noisy `console.log` instrumentation or log raw secrets, MACs/IPs unnecessarily.

## Nearest next UX slice

The next agreed small UX task remains the thermometer card header:

- Tabler thermometer/temperature icon in the upper-left,
- align with Plug-card header rhythm,
- briefly pulse blue only when the existing per-sensor sample `seenAtMs` strictly advances,
- no pulse on mount/rerender/tab switch,
- no second freshness store.

The new saved-sensor presentation boundary created by `c67ac66c...` is the correct place for this behavior.

## Physical S22+ QA still pending

When the phone is available again:

1. verify the exact target with ADB,
2. run the existing alpha install workflow on the current branch,
3. launch and smoke-test Plugs, Thermometers, Settings, Plug settings and BLE-related entry points,
4. clear/capture `adb logcat` around launch and navigation,
5. inspect AndroidRuntime/Capacitor/WebView/JS errors and ANRs,
6. record the installed SHA and result in docs.

Prefer the existing repo Android/ADB scripts and `docs/development/android-device-adb.md`; do not invent a parallel install workflow.

## Process guardrails

- continue on `work/plug-screen-automation-entry-20260917`,
- use the exact Local Agent binding above,
- check `.agent/status/daemon.json` before a new Local Agent task,
- never edit the same work branch while a Local Agent task is active,
- keep changes small and behavior-oriented,
- preserve `InstalledAutomation` ownership and runtime safety,
- do not raise architecture budgets to hide responsibility growth.
