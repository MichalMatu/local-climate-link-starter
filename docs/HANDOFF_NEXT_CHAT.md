# Next chat handoff

The current baseline includes stabilization, the stable Automation Engine/config split and multiple thermometers per Climate automation. Before new implementation work, fetch fresh `main` and verify the Local Agent daemon/binding from `AGENTS.md`.

Completed stabilization includes canonical Plug identity, actionable Add errors, managed remote-to-local automation recovery, Forget vs Uninstall separation, Climate/Time identity gates before runtime mutation, restored Plug settings access for installed automations, and preservation of existing Climate/Time edit + Plug settings features.

`climate-engine-v1` is a stable runtime body with typed compact config. On Shelly firmware that supports `Script.storage`, ordinary Climate edits persist config through `Script.Eval` without replacing engine code; unsupported firmware keeps the compatible `Script.PutCode` fallback. Persistent updates validate hash/version, survive runtime restart, participate in remote recovery and roll back the previous stored config on failure.

Multiple thermometers are implemented up to 8 members with `avg`, `min`, `max` and `firstValid` aggregation, per-sensor freshness and safe-OFF when no configured sensor remains usable. The mobile draft/edit boundary now uses normalized physical BLE `runtimeAddress` as canonical sensor identity and tracks recovered membership provenance so explicit user edits do not silently retain inherited sensors.

Real Samsung S22+ + Shelly Plug S Gen3 firmware 1.7.5 re-acceptance passed on 2026-09-22 at branch SHA `77b50f255d023b5f0f6fe4648e71c425b8bde989`: Edit showed exactly four physical sensors instead of duplicated logical rows, explicit membership editing dropped inherited recovery membership, and Load from Shelly restored the complete four-sensor runtime set. Production script SHA-256 remained `8acb3f2e2b02936e07b960921fce25ab57004139e021ccc5e4e18f07acf2fe41`, schedules stayed empty and final relay state was OFF.

Next product work after this slice is merged:

1. expose per-configured-sensor Plug-side BLE diagnostics and reading provenance in the mobile UI;
2. continue with soil moisture through the existing typed sensor/config model;
3. add richer timing operators while preserving explicit safety precedence;
4. keep the Shelly Script Library/configurator as a parallel track that reuses the same identity, ownership and mutation-safety boundaries.

Do not reopen a broad refactor phase. BLE Shelly transport remains a later hardware feasibility stage and must reuse the same automation/config ownership model.

Canonical project context is only `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, this file and `docs/testing/hardware-matrix.md`. Historical plans remain available in Git history.
