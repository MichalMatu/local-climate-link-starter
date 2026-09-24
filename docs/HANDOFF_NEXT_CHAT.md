# Handoff — UX accepted, targeted closeout before next feature

Status: **2026-09-24**

Repository: `MichalMatu/shelly-link`

Canonical restart point: **fresh `main`**. The broad UX stabilization pass is accepted and merged. Do not reopen a broad redesign. One **targeted UX closeout** is intentionally allowed next because the user has identified concrete visual inconsistencies on the real phone that the current automated visual contract did not catch.

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

### Targeted UX closeout — NEXT

The user will provide real-phone screenshots showing remaining inconsistencies after the last refactor. Treat these as concrete defects, not as permission for another broad visual redesign.

For each screenshot-backed defect:

1. identify the visual inconsistency and the correct shared owner (`@lcl/design-tokens`, `@lcl/ui`, or product-local composition);
2. fix the shared primitive/role when multiple screens express the same interaction or surface role instead of adding screen-specific overrides;
3. check why the existing `quality:ux` / visual contract did not catch the defect;
4. extend the canonical visual coverage when the missing protection is generalizable;
5. validate on the real Samsung S22+ before declaring the UX closeout complete.

The goal is to finish consistency and improve the regression net, not to change the accepted information architecture.

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

## Development direction — DECIDED

The active product direction after the targeted UX closeout is:

1. **Targeted UX closeout from real S22+ screenshots.** Fix only concrete inconsistencies, improve the visual regression contract where it missed them, validate on the phone, then close UX again.
2. **Shelly management / relay control over BLE.** Start with a narrow real-hardware RPC-over-BLE spike and reuse the existing `ShellyRpcTransport` ownership boundary. Prove identity, status and safe relay control first (`OFF -> ON -> OFF` with explicit final state), then progressively cover the script/runtime lifecycle. BLE is a transport adapter, not a second product model.
3. **Curated Shelly Script Library with simple configurators.** Use verified official/approved scripts and expose a product flow such as `choose -> configure -> install/run`. Reuse the same physical identity, transport, safety and installed-automation ownership rules. Do not introduce arbitrary unmanaged scripts alongside a Shelly Link-managed automation without an explicit ownership redesign.
4. **History / datalogger redesign and port.** Preserve `work/kvs-datalogger` as source material, but do not rebase-and-merge it mechanically. Its parked two-script design predates the current exclusive Shelly Scripts ownership model and now conflicts with it. When resumed, first choose a design compatible with current ownership, then port only the still-valid codec/KVS/client/generator pieces and rerun software + real-hardware acceptance.

**Soil-moisture support is deferred.** It remains a possible future sensor track but is no longer the next product milestone.

Richer timing/operators and advanced automation UX remain later work unless a concrete product need moves them forward.

When this handoff conflicts with the older ordering in `docs/ROADMAP.md`, this section records the newer product decision. Synchronize the roadmap when the next implementation branch is opened.

## Datalogger branch — PARKED SOURCE MATERIAL

`work/kvs-datalogger` is intentionally retained but is **not merge-ready**.

Current restart assumptions:

- do not merge it into `main` as-is;
- do not treat a rebase alone as sufficient;
- the old History Tail architecture uses a second long-lived Shelly script and therefore must be reconciled with current exclusive script ownership;
- preserve useful pure/history/KVS work where it still fits the current architecture;
- re-establish ownership verification, cross-runtime diagnostics contract, KVS capacity behavior, lifecycle behavior and real Plug S Gen3 memory/hardware acceptance before any future merge;
- Climate safety/relay behavior remains strictly independent of History failure.

See the parked branch's `docs/KVS_DATALOGGER_IMPLEMENTATION.md` when this track is resumed.

## Branch state

Expected long-lived/intentional branches now:

- `main` — canonical product source of truth;
- `agent-control` — Local Agent infrastructure only;
- `work/kvs-datalogger` — intentionally parked source material for a future redesigned history track.

Completed UX branches, TP357 work branch and placeholder branch have been deleted. Do not recreate or reuse retired UX task IDs/branches.

## Restart checklist

At the beginning of the next development session:

```text
read AGENTS.md
read docs/HANDOFF_NEXT_CHAT.md
read docs/ARCHITECTURE.md
read docs/ROADMAP.md
read docs/UX_VISUAL_CONTRACT.md when working on UX
fetch fresh main
check agent-control daemon
confirm the intended work branch/track before editing
```

For the immediate next session, the intended track is the screenshot-driven targeted UX closeout. After that is accepted and merged, move to the Shelly-over-BLE hardware spike unless the user explicitly changes priority.

`main` plus the canonical docs above are the source of truth. Do not reuse old UX task IDs or retired UX branches.
