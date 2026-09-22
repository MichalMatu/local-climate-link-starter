# Next chat handoff

This handoff is for the first chat **after PR #34 is merged into `main`**.

Start from a fresh `main`. Do not continue from an old worktree or cached branch SHA. Before any implementation, verify:

1. PR #34 is merged and the local checkout matches fresh `origin/main`;
2. `agent-control:.agent/status/daemon.json` is healthy and idle;
3. Local Agent binding is exactly `e75c77cb-7589-4452-94b2-decc97ff85a1`;
4. no duplicate task is already running for the same goal.

Canonical context is intentionally small: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, this file and `docs/testing/hardware-matrix.md`. Historical plans belong in Git history.

## Baseline completed by PR #34

The product model remains:

```text
physical Plug -> optional installed automation
```

The merged baseline includes:

- stable `climate-engine-v1` plus typed persistent runtime config;
- capability-gated `Script.storage` / `Script.Eval` config-only Climate edits with guarded fallback;
- up to 8 Climate thermometers with `avg`, `min`, `max` and `firstValid` aggregation;
- per-sensor freshness with safe-OFF when no configured sensor remains usable;
- normalized physical BLE `runtimeAddress` as the canonical mobile thermometer identity;
- persisted recovery provenance scoped to the installed automation ID so it survives Edit reopen/app restart without leaking between automations, and does not silently retain inherited additional sensors after an explicit membership edit;
- authoritative Load from Shelly reconstruction of the complete runtime sensor set;
- setup-draft persistence kept behind the hardware-setup data boundary;
- responsive E2E fixtures updated to the current `lcl.hardwareSetupDraft.v9` contract.

Pre-merge verification for the final PR source included focused identity/recovery coverage, the full mobile test suite, 100% core coverage, successful production builds and the complete responsive Playwright suite. Real Samsung S22+ + Shelly Plug S Gen3 firmware 1.7.5 re-acceptance also passed. Exact dated hardware evidence, script hash and final relay state are recorded only in `docs/testing/hardware-matrix.md`.

## Next task: per-sensor Plug-side diagnostics and provenance

Do a **preimplementation architecture audit first**, without changing behavior.

Audit the complete path for the existing Climate diagnostic snapshot:

```text
Shelly climate runtime
-> /diag payload
-> decoder/types
-> mobile runtime/reading store
-> Plug / Climate UI
```

The implementation target after that audit is:

- one diagnostic record per configured thermometer;
- normalized `runtimeAddress` as the join key;
- temperature, humidity, battery, RSSI, last-seen/age and stale/fresh state per sensor;
- explicit UI provenance for `phone BLE`, `Plug BLE` and recovered/runtime data;
- no stale Plug-side display after a sensor is removed from configuration or stops being observed;
- no change to aggregation, rule evaluation or safe-OFF semantics merely to support presentation diagnostics.

Before coding, identify product owner, state owner, side-effect owner, UI owner, final file layout and test owner as required by `AGENTS.md`. Pay particular attention to runtime memory/script-size cost and avoid adding another sensor identity.

## After that

Continue in this order unless a concrete blocker changes the priority:

1. soil moisture through the same typed sensor/config model;
2. richer timing operators with explicit safety precedence;
3. advanced automation UX/templates;
4. Shelly Script Library/configurator as a parallel, isolated track;
5. Shelly BLE transport only after a real-hardware feasibility spike.

## Do not reopen

- no broad refactor phase;
- no parallel automation ownership model;
- no URL/IP-as-device identity;
- no Home Assistant, MQTT, cloud service or 24/7 server requirement in the default product flow;
- no destructive/runtime mutation without identity verification;
- no weakening of boot OFF, stale-sensor OFF or explicit final relay-state rules.

For any hardware-facing slice, finish with dated real-device evidence in `docs/testing/hardware-matrix.md`.
