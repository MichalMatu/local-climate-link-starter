# Handoff — continue UX refinement from clean main

Status: **2026-09-23**

Repository: `MichalMatu/local-climate-link-starter`

Canonical restart point for the next session: **fresh `main`**. Completed work branches from the previous diagnostics and UX slices are retired after merge. `agent-control` remains only as Local Agent infrastructure.

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

## Current product state

The architecture/lifecycle baseline is stable and the first major UX correction pass is complete.

Key established behavior:

- Shelly physical identity is canonical; URL/IP is transport only;
- a saved Plug remains useful without automation;
- Climate and Time use one clear installed-automation ownership model;
- Climate supports 1–4 thermometers with `avg`, `min`, `max` or `firstValid` aggregation;
- per-sensor Plug diagnostics are available and join mobile rows by normalized BLE `runtimeAddress`;
- valid managed runtimes are not rewritten by passive recovery;
- local Shelly execution remains independent of phone/cloud after configuration.

## UX state after the first stabilization pass

Plug details were flattened into one surface with five local sections:

```text
Automation | BLE | Device | Script | Info
```

The old nested Settings, Diagnostics and Script detail pages were removed after their data was migrated to the correct owner surface.

The first UX pass also:

- grouped LED, physical button mode and Shelly Cloud under Device;
- gave BLE a dedicated surface with room for future capabilities;
- moved script-specific diagnostics into Script and device diagnostics into Info;
- removed duplicated Plug/detail data where the dashboard already owns it;
- rebuilt LED controls to match the product UI instead of native/system-looking controls;
- introduced reusable tokenized `ToggleSwitch` and `ColorSwatch` primitives where justified;
- fixed standalone Add return navigation;
- improved script-loading feedback and narrow mobile sensor selection;
- updated responsive/E2E contracts for the new structure.

No automation ownership, runtime-safety or Shelly mutation semantics were intentionally changed by the UX restructuring.

## Verification / real device

The completed UX candidate passed `pnpm check:full` on the MacBook, including formatting, lint, UX/repository/feature-boundary gates, TypeScript, unit/integration tests, coverage, build and responsive Playwright.

A build from UX commit `4cb7666f0a4aec809f48ff7186a2b4ecc74c5794` was installed on the real Samsung SM-S906B / S22+ with Android 16 using `adb install -r`, preserving app data. The application cold-started successfully.

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
