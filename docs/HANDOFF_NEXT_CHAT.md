# Handoff — continue UX refinement from clean main

Status: **2026-09-23**

Repository: `MichalMatu/local-climate-link-starter`

Canonical restart point for the next session: **fresh `main`**. Completed work branches from the previous diagnostics and UX slices are retired after merge. `agent-control` remains only as Local Agent infrastructure.

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Current product state

The architecture/lifecycle baseline is stable and the second UX correction checkpoint is complete.

Key established behavior:

- Shelly physical identity is canonical; URL/IP is transport only;
- a saved Plug remains useful without automation;
- Climate and Time use one clear installed-automation ownership model;
- Climate supports 1–4 thermometers with `avg`, `min`, `max` or `firstValid` aggregation;
- per-sensor Plug diagnostics are available and join mobile rows by normalized BLE `runtimeAddress`;
- valid managed runtimes are not rewritten by passive recovery;
- successful Climate recovery also restores missing configured thermometer identities into the saved Thermometers list by canonical BLE MAC, without duplicating existing entries or changing current rule membership;
- local Shelly execution remains independent of phone/cloud after configuration.

## UX state after the second stabilization checkpoint

Plug details remain one surface with five local sections:

```text
Automation | BLE | Device | Script | Info
```

The current UX baseline now establishes:

- Automation edits Climate configuration inline; there is no separate Edit page/button;
- live reason/rule relay/actual Shelly relay state remains visible above the inline editor;
- BLE keeps Bluetooth state and configured sensor diagnostics in one coherent section;
- Device owns LED, physical button mode and Shelly Cloud;
- Device toggles use compact checkbox/tick rows rather than the retired oversized `ToggleSwitch`;
- LED colors use fixed presets plus a styled custom-color picker modal, and brightness fields expose `%` consistently;
- Device forms protect dirty local drafts from background refetches; a successful save establishes the confirmed Shelly state as the new baseline;
- Script is code-focused with contained loading/error feedback;
- script/runtime resource diagnostics were moved to Info alongside device diagnostics;
- old nested Settings/Diagnostics/Script detail pages remain removed;
- standalone Add Plug/Thermometer pages intentionally have no page-local Back control; bottom navigation plus platform/browser Back own return navigation, and regressions are blocked by tests + UX gate.

No automation ownership, runtime-safety or Shelly mutation semantics were intentionally changed by this UX restructuring.

## Verification / real device

Current `main` `9bb6b2f145b90d295879a75012e15fc5258f95ae` includes the UX checkpoint plus passive thermometer-registry recovery from a verified managed Climate automation. The final repository gate passed `pnpm check`; the mobile suite was 279/279 green, with the recovery-focused hardware/setup suite 70/70 green.

That exact `main` was clean-installed on the real Samsung SM-S906B / S22+ with Android 16 using `pnpm android:phone-alpha`. Uninstall/install and cold start succeeded and the app opened with an empty Plug list. The user then re-added the physical Plug and confirmed that the existing Climate automation was recovered and its configured thermometer was automatically restored into Thermometers without duplication.

The user's live Climate setup may intentionally use only **1 thermometer**. Do not restore a previous 4-sensor acceptance configuration or mutate the real Shelly merely to reproduce historical test state.

## NEXT SESSION — continue UX refinement

The next task is **more UX correction/stabilization of the existing product**, based on real S22+ screenshots and user feedback.

Do not start Soil moisture, richer timing, a script-library expansion or Shelly-over-BLE implementation until the user explicitly says the current UX pass is accepted.

Working method:

1. start from fresh `main`;
2. inspect the concrete screenshot/problem first;
3. add the issue to the UX backlog;
4. discuss one problem at a time before broad implementation;
5. prefer the shared design system/tokens for reusable controls;
6. keep product-specific layout inside the owning feature;
7. avoid large duplicate headings, nested cards/pages and one-off global CSS hacks;
8. use available screen space efficiently on 360/390/412 px phones and tablet/desktop widths;
9. preserve existing state/side-effect ownership and hardware safety;
10. run focused checks while iterating and `pnpm check:full` before closing a meaningful UX slice.

Representative responsive viewports remain:

```text
360x800
390x844
412x915
768x1024
1440x900
```

Use the real S22+ when the acceptance question depends on Android/native navigation, BLE discovery or real Shelly behavior. Presentation-only inspection must not press Save or otherwise mutate the live runtime unless that mutation is the explicit test objective.

## AFTER UX — planned next product work

Once the user accepts the UX baseline, the next product directions are, in order of current intent:

1. **BLE soil-moisture sensor support** through the existing typed sensor/config/diagnostic model;
2. **Shelly communication/management over BLE**, beginning with a real-hardware feasibility spike and reusing the same RPC transport/ownership boundaries.

These are separate Bluetooth concerns. Do not combine them into one transport or ownership model.

Later roadmap items include richer timing/operators, advanced automation UX and the optional Shelly Script Library track. See `docs/ROADMAP.md`.

## Restart checklist

At the beginning of the next chat:

```text
read AGENTS.md
read docs/HANDOFF_NEXT_CHAT.md
read docs/ARCHITECTURE.md
read docs/ROADMAP.md
fetch fresh main
check agent-control daemon
confirm no stale work branch/task is being reused
```

Do not rely on old task IDs or old work-branch SHAs. `main` + the canonical docs above are the source of truth.
