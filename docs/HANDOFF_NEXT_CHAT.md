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
- Climate install/edit/repair uses exclusive Shelly Script ownership: verify physical Plug identity, confirm or force relay OFF, delete every existing Shelly Script, then create/start a fresh managed runtime; script IDs are intentionally not stable across replacement.
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

## TP357 battery decoding — resolved

The 2026-09-24 battery defect has been captured and fixed from real BLE packets.

macOS CoreBluetooth saw five affected `TP357` devices with six-byte manufacturer payloads such as `C2 DC 00 32 02 2C`, each carrying raw battery byte `0x02`. The existing sixth device advertises as `TP357S` with seven-byte payload `C2 DF 00 4A 22 0B 01`, carrying raw battery byte `0x22`. Both values have low-two-bit state `2`, which represents 100%. The former `2%` and `34%` displays were both caused by treating the entire byte as a percentage.

The phone parser, installed Climate runtime parser and discovery parser now share the same semantic mapping: `0 -> 1%`, `1 -> 50%`, `2 -> 100%`, while state `3` is unknown and does not invalidate temperature/humidity. Captured TP357 and TP357S frames are covered by regression tests. Do not introduce enclosure-color detection or a direct-percentage fallback for these devices.

Relevant owners:

- `packages/ble-core/src/parsers/tp357.ts` — phone-side TP357 parsing;
- `packages/script-generator/src/shelly/generate.ts` — installed Climate runtime TP357 parsing;
- `packages/script-generator/src/shelly/discoveryParsing.ts` — temporary Shelly BLE discovery parsing.

## Next product work

Priority order is now:

1. **BLE soil-moisture sensor support** through the existing typed sensor/config/diagnostic model;
2. then **Shelly management over BLE**, starting with a real-hardware feasibility spike and reusing the same RPC ownership boundaries.

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
