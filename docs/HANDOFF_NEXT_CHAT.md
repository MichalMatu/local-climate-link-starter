# Next chat handoff

Stabilization is the current baseline. Before new implementation work, fetch fresh `main` and verify the Local Agent daemon/binding from `AGENTS.md`.

Completed stabilization includes canonical Plug identity, actionable Add errors, managed remote-to-local automation recovery, Forget vs Uninstall separation, Climate/Time identity gates before runtime mutation, restored Plug settings access for installed automations, and preservation of existing Climate/Time edit + Plug settings features.

Real Samsung S22+ + Shelly Plug S Gen3 acceptance passed for both fresh-store recovery and Forget -> re-add. The managed script stayed byte-identical (`SHA-256 6b9aa123b72e85828ae4d930d3a7f24df4ce0e2abb55230ae409bcff23538215`), schedules stayed empty, and the relay stayed OFF.

Next work:

1. perform a read-only audit of fresh `main` and classify remaining product items `DONE / PARTIAL / NOT DONE / DO POPRAWY`;
2. freeze the stabilized architecture;
3. start Automation Engine + runtime config/data separation from `docs/ROADMAP.md`;
4. do not start another broad refactor or BLE implementation before that separation is defined.

Canonical project context is only `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, this file and `docs/testing/hardware-matrix.md`. Historical plans remain available in Git history.
