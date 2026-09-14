# Local Climate Link — next chat handoff

Updated: 2026-09-14

This is the canonical continuation handoff for the current device/rule decoupling branch.

## Hard repository binding and execution model

Work only on:

- repository: `MichalMatu/local-climate-link-starter`
- repository id: `local-climate-link-starter`
- Local Agent binding: `e75c77cb-7589-4452-94b2-decc97ff85a1`
- Local Agent control branch: `agent-control`
- managed clone: `/Users/michal/agent-workspace/repos/local-climate-link-starter/work`
- active work branch: `work/device-rule-decoupling-20260913`

Every Local Agent task must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

ChatGPT plans and authors; Local Agent executes deterministic project/tool/device commands. Never launch local Codex or another AI agent from a Local Agent task. Check `.agent/status/daemon.json` before editing the work branch.

Do not merge this work branch to `main` during the acceptance pass.

## Stable rollback baseline

The previously user-accepted v2.0.10 build remains frozen at annotated tag:

```text
stable-20260912-v2.0.10-ux-polish
8173f0851adc77222fc3e98b02113ff28f7119fd
```

Do not move or recreate that tag.

## Current decoupling checkpoint

Checkpoint entering the final documentation/acceptance pass:

```text
06da99e9dcc72c0e66d12269cd6605b4536e4c7c
Remove legacy setup draft store
```

The coordinated product cutover is complete:

- Plugs, Thermometers and Rules are independent registries.
- Rules route and mutate by `ruleId`.
- The dashboard renders Rule registry entries, not installation snapshots.
- Climate and time runtimes use rule-centric lifecycle services.
- Legacy `InstalledAutomation`, installation runtime/store/screens, old time-automation product code, hardware setup orchestrator and persisted `lcl.hardwareSetupDraft.v8` store are removed.
- Responsive E2E now targets the current `Rules / Plugs / Thermometers / Settings` product and passes 7/7.

See `docs/implementation/device-rule-decoupling-progress.md` and `docs/adr/ADR-0006-independent-devices-and-rules.md` for the current model.

## Runtime invariants that must not regress

### Climate AUTO

- exact managed climate script remains running,
- canonical runtime mode is readable and AUTO,
- BLE runtime and diagnostics remain live,
- automatic relay decisions are allowed only for the owning rule.

### Climate MANUAL

- exact managed climate script remains running,
- runtime/diagnostics remain live,
- automatic output decisions are blocked in-process,
- relay is forced/verified OFF before direct manual control is permitted.

### Unknown / stopped / missing

These are failure or maintenance states, not aliases for AUTO or MANUAL. Unknown/unreadable mode fails closed. Normal AUTO/MANUAL switching must not use `Script.Stop`/`Script.Start`.

### Time rules

Native Shelly Schedule jobs are owned by exact ids in rule deployment metadata. Climate active-hours constraints are separate and remain inside the climate script.

## Current architecture boundaries

- `flows/devices/plugs`: plug persistence, registration and guarded standalone runtime operations.
- `flows/devices/sensors`: sensor persistence and live sensor management.
- `flows/rules`: rule model/editor/lifecycle/runtime/ownership.
- `flows/registry/devicesAndRules.ts`: composed independent registries.
- `flows/runtime/relaySafety.ts`: generic OFF-and-confirm safety primitive.
- `flows/hardware-setup`: only surviving narrow discovery/diagnostic/validation helpers and transient `draftDevices.ts` contracts; no durable hardware-draft store.
- Screens orchestrate and present; business transactions remain in flow/service modules.

No compatibility readers, dual writes or adapters should recreate the deleted installation/draft persistence model.

## Current verification state

Before this final acceptance pass:

- `pnpm check` is green on the current implementation candidate.
- mobile tests at the latest cleanup: 31 files / 156 tests passed.
- current responsive Playwright: 7/7 passed across phone, tablet and desktop sizes.
- repository and UX quality gates pass.
- earlier Shelly Plug S Gen3 firmware 1.7.5 service/runtime hardware smokes exercised real ON/OFF and AUTO/MANUAL discovery restoration and explicitly finished relay OFF.

## Exact remaining work

1. Refresh stale architecture/troubleshooting documentation and run `pnpm check:full`.
2. Build/sync/install the candidate APK on Samsung SM-S906B (`RFCT70L7E8J`) using the repository Android workflow.
3. Cold-start and inspect Rules, Plugs, Thermometers, Settings, climate/time editors and rule details on the physical device. Capture screenshots and fix real safe-area, overflow, spacing, touch-target, form/list/detail or navigation problems.
4. Run final hardware smoke if the Shelly environment is available. Real relay ON/OFF is authorized; the last operation must explicitly verify relay OFF.
5. Record final SHA and evidence. Do not merge to `main` automatically.
