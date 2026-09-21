# Next chat handoff

Stabilization and the first Automation Engine/config separation stage are the current baseline. Before new implementation work, fetch fresh `main` and verify the Local Agent daemon/binding from `AGENTS.md`.

Completed stabilization includes canonical Plug identity, actionable Add errors, managed remote-to-local automation recovery, Forget vs Uninstall separation, Climate/Time identity gates before runtime mutation, restored Plug settings access for installed automations, and preservation of existing Climate/Time edit + Plug settings features.

`climate-engine-v1` is now a stable runtime body with typed compact config. On Shelly firmware that supports `Script.storage`, ordinary Climate edits persist config through `Script.Eval` without replacing engine code; unsupported firmware keeps the compatible `Script.PutCode` fallback. Persistent updates validate hash/version, survive runtime restart, participate in remote recovery and roll back the previous stored config on failure.

Real Shelly Plug S Gen3 firmware 1.7.5 acceptance confirmed config-only persistence with unchanged engine bytes, persisted-config reload after runtime restart, safe cleanup, unchanged production script/schedules and final relay OFF. Samsung S22+ acceptance is part of the final slice closeout before merge.

Next product work after this slice is merged:

1. multiple thermometers per automation;
2. explicit aggregation operators: `avg`, `min`, `max`, `firstValid`;
3. preserve partial/all-sensor stale-data and safe-OFF semantics;
4. then continue with soil moisture and richer timing operators from `docs/ROADMAP.md`.

Do not reopen a broad refactor phase. BLE Shelly transport remains a later hardware feasibility stage and must reuse the same automation/config ownership model.

Canonical project context is only `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, this file and `docs/testing/hardware-matrix.md`. Historical plans remain available in Git history.
