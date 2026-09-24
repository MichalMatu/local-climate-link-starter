# Handoff — UX accepted, continue from clean main

Status: **2026-09-24**

Repository: `MichalMatu/shelly-link`

Canonical restart point: **fresh `main`**. The UX stabilization pass is accepted and closed. Do not reopen layout work without a concrete new problem.

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Stable product baseline

- Shelly physical identity is canonical; URL/IP is transport only.
- A saved Plug remains useful without automation.
- Climate and Time use one installed-automation ownership model.
- Climate supports 1–4 thermometers with `avg`, `min`, `max` or `firstValid` aggregation.
- Per-sensor Plug diagnostics join mobile rows by normalized BLE `runtimeAddress`.
- Passive recovery does not rewrite a valid managed runtime.
- Successful Climate recovery restores missing configured thermometer identities into Thermometers by canonical BLE MAC without duplicates or membership changes.
- Shelly executes installed automation locally without phone/cloud dependency after configuration.

## Accepted UX baseline

Plug detail is one surface with five local tabs:

```text
Automation | BLE | Device | Script | Info
```

Established rules:

- Automation owns live rule/relay state and inline Climate editing; there is no nested Edit page.
- BLE owns Bluetooth state, configured sensor readings/diagnostics and scan controls.
- Device owns LED, physical button mode and Shelly Cloud.
- Script is code-focused; runtime/resource diagnostics live in Info.
- Info uses matching inline-framed `Shelly` and `Diagnostics` groups.
- Tab surfaces are flat by default; framed groups are used only for closed data/control groups; `Disclosure` is reserved for optional expandable content; separators are explicit and never inferred from semantic nesting such as `section > section`.
- Device forms protect dirty local drafts from background refetches.
- `Advanced` and Settings diagnostics use the shared Disclosure pattern.
- LED presets are 4×2 on phone widths and 8×1 on wider layouts.
- Standalone Add Plug/Thermometer pages intentionally have no page-local Back control.

### Dashboard Climate card — freeze this presentation

The accepted card intentionally keeps the compact pre-experiment layout:

- no redundant `Humidity` / `Temperature` visual labels; accessible names remain;
- the primary configured thresholds are shown on **one line** as `ON … · OFF …`;
- dashboard thresholds come from the user's configured rule limits, not VPD-derived effective runtime thresholds;
- humidity thresholds are displayed as whole percentages;
- VPD remains the simple existing form `current → target kPa` when VPD Assist is enabled;
- do **not** add target humidity, dynamic VPD threshold bands, extra explanatory labels or layout shifts to this card unless explicitly requested;
- keep the literal `→` in the same VPD text run; the accepted S22+ screenshot does not require an optical-offset hack.

For the accepted live setup the card showed `ON 60% · OFF 90%` and `1.00 → 1.00 kPa` while retaining the original card geometry.

Automation detail may still show the VPD Assist working range because that is configuration context; the dashboard must not duplicate that diagnostic detail.

## Verification / real device

- UX round 3 candidate `9315cbad7236d6322ccd414b3239e006e971553a` passed exact `pnpm check:full` and real S22+ presentation acceptance.
- UX round 4 candidate `75780d08b6ed579728e68ab94cc819b1ce79a5cb` passed exact `pnpm check:full` and real S22+ tab-hierarchy acceptance.
- Final dashboard correction `349446f86f6d63c37ececa439ec12ef826b06d2f` restored the accepted card layout and changed only threshold presentation to use configured values. Its full `pnpm check:full` passed, and the exact build was installed on Samsung SM-S906B / Android 16 with `adb install -r`, preserving app data.
- Final S22+ inspection confirmed `ON 60% · OFF 90%`, simple VPD `current → target kPa`, unchanged AUTO/MANUAL placement and no extra dynamic-range content on the card.
- Presentation-only acceptance did not press Save or deliberately mutate relay/runtime/schedules.
- Earlier clean-install recovery acceptance at `9bb6b2f145b90d295879a75012e15fc5258f95ae` remains valid.

The live Climate setup may intentionally use only **1 thermometer**. Do not restore a historical 4-sensor test configuration merely to reproduce old acceptance state.

## Open hardware defect — TP357 battery decoding

Fix this before starting the next product expansion.

Observed on 2026-09-24:

- five used **silver** TP357 units with fresh AAA batteries all show approximately `2%` battery in Shelly Link;
- one existing **white** TP357 appears to show a plausible battery percentage;
- it is not established which enclosure color/revision is chronologically newer. Color is only an observation and must never be used to select a parser variant.

What is already established from the code:

- `packages/ble-core/src/parsers/tp357.ts` currently exposes manufacturer payload byte 4 directly as `batteryPct`;
- `packages/script-generator/src/shelly/discoveryParsing.ts` does the same in generated Shelly runtime parsing, so both phone and installed-runtime paths need the same correction.

External reference behavior:

`Bluetooth-Devices/thermopro-ble` treats TP357S/TP397/TP393 battery as the lower two bits of byte 4 and maps `0 -> 1%`, `1 -> 50%`, `2 -> 100%`. The source explicitly says the bit interpretation was verified with a TP357S on a laboratory power supply. This makes the five observed raw `2` readings very likely to mean a full-battery state rather than literal `2%`.

Reference source:

`https://github.com/Bluetooth-Devices/thermopro-ble/blob/main/src/thermopro_ble/parser.py`

Do **not** patch this as a blind `2 -> 100` conversion. The existing white unit appears to behave differently, so the first implementation step is a real-BLE capture of full manufacturer data from at least one silver unit and the white unit. Compare advertised name, payload length and full bytes and determine whether there are genuinely multiple encodings/revisions.

Required fix shape after capture:

1. one semantic TP357 battery-decoding rule for both phone and generated Shelly runtime, with validated variant detection only if the real packets prove it is necessary;
2. fixtures from the observed white and silver packets plus regression tests for both parsing paths;
3. no case-color detection;
4. no regression to temperature, humidity or sensor identity;
5. real-hardware acceptance proving the fresh-battery silver unit no longer renders `2%`, the white unit remains correct, and phone/Shelly diagnostics agree.

## Next product work

Priority order is now:

1. **fix TP357 battery decoding compatibility** using the capture/acceptance criteria above;
2. **BLE soil-moisture sensor support** through the existing typed sensor/config/diagnostic model;
3. then **Shelly management over BLE**, starting with a real-hardware feasibility spike and reusing the same RPC ownership boundaries.

The soil-sensor track and Shelly-over-BLE transport track are separate Bluetooth concerns. Do not combine sensor transport with Shelly management ownership.

Later roadmap items remain richer timing/operators, advanced automation UX and the optional Shelly Script Library track. See `docs/ROADMAP.md`.

## Branch state

Expected long-lived/intentional branches after UX cleanup:

- `main` — canonical product source of truth;
- `agent-control` — Local Agent infrastructure only;
- `work/kvs-datalogger` — intentionally parked, unmerged datalogger work from a separate track; it is not part of the accepted UX baseline and must not be merged or deleted as incidental cleanup.

All completed UX work branches should stay deleted.

## Restart checklist

At the beginning of the next development session:

```text
read AGENTS.md
read docs/HANDOFF_NEXT_CHAT.md
read docs/ARCHITECTURE.md
read docs/ROADMAP.md
fetch fresh main
check agent-control daemon
confirm the intended work branch/track before editing
```

`main` plus the canonical docs above are the source of truth. Do not reuse old UX task IDs or retired UX branches.
