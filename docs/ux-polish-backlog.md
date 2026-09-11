# UX polish backlog

This note keeps the current UI review decisions small and explicit so later passes do not accidentally mix behavior changes with visual cleanup.

## Current staged pass

1. Rule setup: replace the permanent rule-summary card with compact info access, use friendly device names in the human summary, and compact VPD assist without changing automation behavior.
2. Sensor list: tighten card spacing, keep the useful readings/settings visible, add a small rename pencil near the device name, use a trash icon for delete, and avoid an accordion for the normal saved-item view.
3. Shelly list: remove redundant refresh/check presentation, surface useful data directly, replace wordy actions with compact icons where clear, consolidate technical explanation into one info modal, and remove only genuine duplicate data.

## Next small polish

- Sensor loading layout: reserve the final temperature/humidity reading slots from the first render so saved sensor cards do not grow when live values arrive. Prefer stable placeholders such as `— °C` and `— %` over an arbitrary card min-height.
- Shelly BLE scanner loading state: keep the scanner in the current modal flow for now, but give the empty scanning state a centered progress indicator with a short `Trwa skanowanie…` message and a small note that discovered thermometers will appear there.
- Remove the redundant BLE start-scan toast once the modal itself clearly communicates active scanning. Keep toasts for errors and meaningful completion/attention states.
- Do not convert BLE scanning to a standalone routed page yet. Revisit that only if the scanner grows into a richer workflow such as filtering, multi-select, device details, saved results, or additional configuration.
- Shelly add flow: collapse `Dodaj gniazdko` and network discovery into one task surface. Keep name and IP visible, expose the IP range and `Rozpocznij skan` inline in the same modal, show scan progress/results there, and let selecting a discovered Shelly populate the form. Remove the current modal-to-modal network-scan transition.
- Network scan status should be inline in the add flow rather than represented by progress toasts. A final success toast such as `Dodano gniazdko` is still appropriate after the whole add operation finishes.

## Modal and toast consistency audit

- Avoid nested modals for one logical task. One user task should stay on one surface and change state inline.
- On mobile, standardize substantial task/workflow dialogs (add/edit/scan/device-detail style flows) on one full-height `workspace`-style presentation so their geometry does not depend on how much content has loaded. The shared `Modal` component already has a full-height `workspace` variant, so prefer reusing that rather than introducing another modal implementation.
- Do not force every dialog full-screen. Keep short destructive confirmations and tiny acknowledgement dialogs compact; full-screen confirmation dialogs would add visual weight without adding useful space.
- Audit all current `Modal` usages and migrate only the task/workflow group to the common mobile presentation in small batches, with 360x800, 390x844 and 412x915 visual checks after each batch.
- Toast position is currently global/fixed, not attached to a modal. The bottom-navigation shell overrides it to `bottom = nav height + spacing-lg + safe-area`, which is why toasts appear noticeably high and can visually sit near the lower edge of a centered modal.
- Unify toast placement app-wide around a single bottom-navigation-aware offset: a small consistent gap immediately above the bottom menu plus the device safe area. Prefer one shared CSS variable/token instead of per-screen offsets. Verify stacked toasts, keyboard-open states and screens without bottom navigation before adopting it globally.
- Keep transient operation progress (`Skanowanie…`, loading, polling) inside the active task surface. Reserve global toasts for completion, warning/error, or information that remains relevant after the task surface closes.

## Explicitly deferred

- VPD algorithm redesign. The runtime currently uses fixed assist margins of 0.25 C for temperature and 2 percentage points for humidity. Audit whether these should derive from the rule hysteresis or become advanced configuration; do not change them during the UI polish pass.
- VPD domain defaults/range beyond basic input validation. Keep the current target behavior until the algorithm audit.
- Deeper Shelly settings restructuring. First make the saved-device surface compact and readable; revisit the full settings information architecture in a later iteration.
- Technical identifiers such as IP/MAC remain available in technical/device detail views, but user-facing summaries should prefer saved device names.

## Guardrails

- Preserve data unless it is genuinely duplicated.
- Prefer small isolated changes with focused checks after every stage.
- Keep domain/automation behavior unchanged unless a later task explicitly targets it.
