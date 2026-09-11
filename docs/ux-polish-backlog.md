# UX polish backlog

This note keeps the current UI review decisions small and explicit so later passes do not accidentally mix behavior changes with visual cleanup.

## Current staged pass

1. Rule setup: replace the permanent rule-summary card with compact info access, use friendly device names in the human summary, and compact VPD assist without changing automation behavior.
2. Sensor list: tighten card spacing, keep the useful readings/settings visible, add a small rename pencil near the device name, use a trash icon for delete, and avoid an accordion for the normal saved-item view.
3. Shelly list: remove redundant refresh/check presentation, surface useful data directly, replace wordy actions with compact icons where clear, consolidate technical explanation into one info modal, and remove only genuine duplicate data.

## Explicitly deferred

- VPD algorithm redesign. The runtime currently uses fixed assist margins of 0.25 C for temperature and 2 percentage points for humidity. Audit whether these should derive from the rule hysteresis or become advanced configuration; do not change them during the UI polish pass.
- VPD domain defaults/range beyond basic input validation. Keep the current target behavior until the algorithm audit.
- Deeper Shelly settings restructuring. First make the saved-device surface compact and readable; revisit the full settings information architecture in a later iteration.
- Technical identifiers such as IP/MAC remain available in technical/device detail views, but user-facing summaries should prefer saved device names.

## Guardrails

- Preserve data unless it is genuinely duplicated.
- Prefer small isolated changes with focused checks after every stage.
- Keep domain/automation behavior unchanged unless a later task explicitly targets it.
