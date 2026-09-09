# Local Climate Link — next chat handoff

Updated: 2026-09-10

This file is the canonical handoff for continuing the current physical-phone E2E/freeze work in a fresh ChatGPT window.

## Hard binding

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- Local Agent chat: `chat-a8988eef`
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`

Every Local Agent task created from this work must contain:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1",
"resources": []
```

Never infer, inspect, queue, cancel, or execute work for another repository. Check `.agent/status/daemon.json` before editing or queueing work. Do not overlap edits with an active Local Agent task on the same branch.

## Canonical code state before handoff docs

The product code tested in this E2E session is:

```text
main = 771b23456cf7b3fafe62cba3263e1f8f7118580b
```

That commit is the merged Android phone-alpha signing stabilization.

The handoff docs themselves are documentation-only commits after that tested product SHA. Before any freeze/version change, distinguish the tested product SHA from later documentation-only main commits and verify the exact diff.

Frozen tag `v2.0.9` must never move:

```text
tag object = 90378921a79ed3ecb43013e322d27629bf15db64
commit     = b44899ba66b202ca05f48a8856a9871daee97832
```

Latest version sequence observed locally on 2026-09-10:

```text
v2.0.9
v2.0.8
v2.0.7
v2.0.6
v2.0.5
v2.0.4
v2.0.3
v2.0.2
v2.0.1
v2.0.0
v1.0
```

The natural next patch candidate is `2.0.10` / Android `versionCode 20010`, but verify release conventions and all version occurrences before writing the bump.

## Physical test hardware

Phone:

- Samsung SM-S906B / Galaxy S22+
- Android 16 / API 36
- ADB serial `RFCT70L7E8J`
- package `link.localclimate.app`
- currently tested alpha signer SHA-256:
  `2909c5fe69d075bde3f18d1f50608880b1c6b8041e08b11d37e9eb4942350b76`

Phone-alpha policy is permanent for this project:

- use `pnpm android:phone-alpha`
- the command must first attempt `adb uninstall link.localclimate.app`
- app data/permissions are intentionally deleted on each fresh phone-alpha install
- do not ask for confirmation again
- alpha signing stays separate from release/Play signing

Real Shelly used in this session:

- `Shelly Plug S Gen3`
- `http://192.168.0.16/`
- model `S3PL-00112EU`
- generation 3
- installed climate script id `1`
- script name `Local Climate Link Thermostat`

Real BLE candidates observed during Shelly-side discovery included:

- TP357 `F7:5F:8D:0F:76:20`, around `24.5°C / 71.0%`, RSSI about `-73 dBm`
- Xiaomi/PVVX BTHome sensor ending `24:CD`; this was the sensor saved into the climate installation and was reporting about `24.6°C / 59.6–59.7%`

## Current installed climate automation

The real climate happy path was installed successfully on the Shelly.

Configuration used:

- mode: Heating
- sensor: Xiaomi/PVVX BTHome sensor `...24:CD`
- ON threshold: `19°C`
- OFF threshold: `20°C`
- VPD assist: OFF

Expected/last safe physical state:

- climate script `running=true`
- relay `OFF`
- `Schedule.List = {"jobs":[], "rev":0}`
- dashboard can reach the real Shelly and shows `Working` after fresh runtime data arrives

Do not change VPD behavior merely because dashboard VPD displays `—` with assist disabled. The generated runtime intentionally keeps `lastVpd=null` when VPD assist is disabled. The user explicitly decided that configurable VPD ranges should remain as they are.

## Physical E2E completed

The following are PASS unless otherwise noted.

### Navigation / Android Back

- root goal -> first-level Back for temperature
- root goal -> first-level Back for humidity
- root goal -> first-level Back for time
- root goal -> first-level Back for manage existing automation
- temperature setup Back
- root Android Back exits/backgrounds app as intended

Add Plug modal/native Back behavior also unwinds correctly. Samsung IME instrumentation was inconclusive (`mInputShown=false` while input view state was ambiguous), so do not claim a separate keyboard PASS and do not spend more time on it unless a user-visible keyboard bug appears.

### Shelly discovery/setup

- real LAN discovery found `192.168.0.16`
- device identity/model/gen read successfully
- Shelly saved into app draft
- live plug status read successfully
- real BLE discovery via Shelly found candidates
- BLE discovery safe-off/cleanup restored climate automation to AUTO/running and relay OFF
- Xiaomi/PVVX sensor saved into draft
- Sensors page showed live temperature/humidity
- Rule page had valid Shelly + sensor selection and enabled Send

### Climate install/runtime/dashboard

- `Send` installed/replaced only the Local Climate Link-owned thermostat script
- installed script id 1 is running
- relay remained OFF with 24.6°C and heating thresholds 19/20°C
- app retained installation across restart before destructive reinstall
- dashboard showed `Working`, temperature, humidity, relay OFF and thresholds
- `Details` screen showed live configuration and controls
- raw `/script/1/diag` matched UI behavior

### Pause/resume

- `Pause automation` stopped the script and confirmed relay OFF
- current resume label is `Start automation`, not the older harness expectation `Resume automation`
- `Start automation` restored `running=true`
- relay remained OFF

Immediately after restarting the script, UI may transiently show `Unknown` until a fresh BLE/runtime sample arrives. Do not treat that transient as failure by itself.

### Shelly LED

Real reversible roundtrip PASS:

1. backed up full `PLUGS_UI.GetConfig`
2. `Turn LED off` -> `leds.mode=off`
3. `Show ON/OFF` -> switch mode, ON green, OFF red
4. climate script stayed running and relay stayed OFF
5. restored the original full LED config exactly

Original observed LED config had switch mode, ON green, OFF black, 100% brightness; do not assume the preset matches the user's original state.

### Time automation ownership protection

On the same Shelly that owns the climate automation:

- opened `Control by time`
- selected/retained the real Shelly
- default times `08:00 / 20:00`
- clicked `Save schedule to Shelly`
- UI correctly blocked with:
  `This output is already owned by climate automation. Remove it before creating a time schedule.`
- `Schedule.List` stayed unchanged and empty
- climate script stayed running
- relay stayed OFF

This is a valid ownership-conflict E2E. Do not delete the working climate automation solely to force a second time-schedule happy path on the only real Shelly.

### Offline Shelly recovery

Reversible phone-only test PASS:

- exact `lcl.installedAutomations.v1` localStorage payload backed up
- climate installation base URL temporarily changed to TEST-NET `http://192.0.2.1/`
- dashboard correctly showed `Offline` and `Cannot reach Shelly.`
- original localStorage payload restored
- dashboard returned to `Working` with real temperature/humidity and relay OFF
- physical climate script remained running and relay OFF throughout

### Script-stopped recovery

Already covered physically by Pause -> Start automation. Do not duplicate the same mutation under another test name unless new evidence requires it.

## Intentionally not claimed PASS

### Stale sensor physical failure

Not physically forced in this session. Do not call it PASS. The runtime has stale fail-safe OFF coverage in deterministic/generated-runtime tests, but no need was found to disable BLE or otherwise disturb the live hardware just to manufacture stale data before freeze.

### Purely visual Android QA

DOM/CDP/native process evidence is not equivalent to human visual inspection. Do not claim visual polish PASS for edge-to-edge/insets/keyboard/layout unless actually observed or captured appropriately.

## Final preflight already completed

Local Agent task:

```text
20260909-freeze-preflight-version-check-v1
```

Result: `done`.

Verified:

- `origin/main` was the tested product SHA `771b23456cf7b3fafe62cba3263e1f8f7118580b`
- `v2.0.9` tag object and peeled commit exactly matched the frozen values above
- `pnpm install --frozen-lockfile` passed
- `pnpm check:full` passed
- repo ended clean

One probe inside that preflight attempted `rg` and reported `rg: command not found`; this did not fail the task because the probe was informational. Do not rely on ripgrep being installed in the Local Agent macOS environment; use `git grep`, `grep`, or another available tool when locating version strings.

## Immediate next work

Continue from here, not from an older audit/plan.

1. Re-read `.agent/status/daemon.json` first and verify exact repo/binding.
2. Fetch current `main` and compare it with tested product SHA. Account for the documentation-only handoff commits before deciding what exact SHA to freeze.
3. Determine every authoritative version location without `rg`. At minimum inspect:
   - root `package.json`
   - `apps/mobile/android/app/build.gradle`
   - any mobile package/app metadata or release scripts that encode `2.0.9` / `20009`
4. Make the smallest consistent version bump, expected candidate `2.0.10` / `20010`, without moving `v2.0.9`.
5. Run full verification on the exact bump commit:
   - `pnpm install --frozen-lockfile`
   - `pnpm check:full`
6. Run final destructive physical install on that exact commit:
   - `pnpm android:phone-alpha`
   - verify uninstall happened first
   - verify exactly one authorized ADB device
   - verify installed version/code/signer and app PID
7. Because clean install deletes app state, run a short fresh-install phone smoke. Do not assume the old localStorage installation survives.
8. Independently verify the Shelly still has the climate script running and relay state known/safe after the phone data reset. Phone uninstall must not remove the Shelly-side runtime.
9. Verify GitHub CI for the exact freeze SHA.
10. Only then create a new immutable version/tag according to repository release conventions. Never move `v2.0.9`.
11. Update `docs/testing/hardware-matrix.md` with the dated September 2026 physical-phone E2E evidence before calling the release fully documented.

If the version bump changes only metadata, do not reopen already-passed physical flows unless the build/install smoke reveals a regression.

## Change philosophy

- evidence-driven
- small, clean, low-risk/high-gain changes
- no speculative refactors
- no backward-compatibility scaffolding unless explicitly requested
- no code change merely because a test harness expected an old UI label
- fix harness assumptions before blaming the product
- keep final physical relay state explicit and known

Read `AGENTS.md` before code changes. Treat this handoff as execution state, not as a replacement for repository rules.
