# UX polish backlog

Updated: 2026-09-12

The main 2026-09-11/12 UX polish pass is complete. This document now contains only deliberately deferred follow-ups; completed work belongs in the handoff and architecture documentation rather than remaining as an apparent TODO list.

## Completed baseline

The accepted v2.0.10 UX baseline includes compact Shelly/sensor cards, consistent round add actions, climate-scoped intent selection, direct Time setup, custom HH/MM wheel selection, compact rule/VPD presentation, unified modal/toast behavior where justified, and separation of setup feedback/lifecycle orchestration from the largest page components.

The exact accepted application checkpoint is `8173f0851adc77222fc3e98b02113ff28f7119fd`, frozen as `stable-20260912-v2.0.10-ux-polish`.

## Deferred UX follow-ups

- VPD algorithm redesign remains out of scope. Current assist margins remain 0.25 C for temperature and 2 percentage points for humidity until a dedicated runtime/algorithm audit justifies a change.
- Revisit whether VPD target defaults/range should change only together with that algorithm audit; do not alter them as cosmetic cleanup.
- Further Shelly settings restructuring should be driven by a concrete management task, not by file size or a desire to add another settings hierarchy.
- Technical identifiers such as IP/MAC stay available in technical/device-detail views; normal summaries should continue to prefer saved human names.
- BLE scanning should remain inside the existing task/modal flow unless it grows into a genuinely richer workflow such as filtering, multi-select, device details or persistent scan results.
- Do not split large locale dictionaries, focused hardware scripts or scenario-heavy tests merely to reduce line counts.

## Guardrails

- Preserve useful data unless it is genuinely duplicated.
- Keep transient progress inside the active task surface; use global toasts for completion, warning/error or information that remains relevant after the task closes.
- Avoid nested modals for one logical task.
- Preserve runtime/safety behavior during visual cleanup.
- Prefer small isolated changes with focused checks.
- Treat architecture line budgets as regression alarms, not goals.
