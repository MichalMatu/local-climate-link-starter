# Device/rule decoupling progress

Branch: `work/device-rule-decoupling-20260913`. Do not merge to `main` before final device acceptance.

## Current checkpoint

The product cutover is complete. Plugs, thermometers and rules are independent durable entities and the active product/runtime path no longer depends on `InstalledAutomation`, installation snapshots or the legacy hardware-setup draft store.

Checkpoint entering this documentation refresh: `06da99e9dcc72c0e66d12269cd6605b4536e4c7c`.

## Current architecture

- `flows/devices/plugs` owns saved plugs, registration, standalone runtime inspection and guarded direct relay operations.
- `flows/devices/sensors` owns saved thermometers and live sensor-management orchestration. A saved sensor is global and is never owned by a plug.
- `flows/rules` owns desired climate/time rules, deployment state, lifecycle transactions, runtime ownership and presentation-independent editor state.
- `flows/registry/devicesAndRules.ts` exposes the independent Plug, Sensor and Rule registries.
- Durable sensor-to-plug association exists only through a climate rule.
- Exactly one rule may own a `(plugId, relayId)` pair.
- The product navigation is `Rules / Plugs / Thermometers / Settings`; rule screens route by `ruleId`.
- Rule names and device names are independent. Renaming either side does not mutate the other identity.

## Runtime and safety invariants

- Plug mutations and rule lifecycle work are serialized per physical plug.
- Raw relay control is available only when ownership is known and unclaimed.
- Climate AUTO/MANUAL is the canonical in-process `R.m` state; normal mode changes do not use `Script.Stop`/`Script.Start`.
- Unknown or unreadable climate mode fails closed.
- Climate deployment is not considered safe after upload alone: exact script identity/hash, MANUAL/OFF state and the safety test must be verified before AUTO can resume.
- BLE discovery preserves the exact prior AUTO/MANUAL state and restores it only after scanner cleanup; unknown prior mode rejects instead of guessing.
- Time rules use native Shelly schedules; climate active hours stay inside the climate runtime and do not create native schedule ownership.
- Delete/redeploy/recovery operations verify exact ownership and use OFF-first cleanup semantics.

## Legacy removal completed

The coordinated cleanup removed the old installation product/runtime path, legacy installation detail screens, the hardware setup orchestrator, the old time-automation module, obsolete LED/install E2E, and the persisted hardware setup draft store. Only narrow transient device contracts needed by surviving discovery/diagnostic flows remain in `flows/hardware-setup/draftDevices.ts`.

The registry persistence test intentionally seeds old storage keys and proves that current registries do not read them. This is a negative isolation test, not a compatibility reader.

## Verification completed so far

- Rule/device registry, ownership, lifecycle and fail-closed runtime tests pass.
- Mobile test suite at the setup-draft removal checkpoint: 31 files / 156 tests passed.
- Responsive E2E was rewritten for the current product and passes 7/7 across 360x800, 390x844, 412x915, 768x1024 and 1440x900 coverage.
- Workspace lint, repository/UX quality gates, typecheck, tests, coverage and builds pass through `pnpm check` on the current candidate.
- Earlier real-device service/runtime smokes on Shelly Plug S Gen3 firmware 1.7.5 exercised relay ON/OFF and AUTO/MANUAL discovery restoration and finished with the relay explicitly OFF.

## Remaining acceptance work

1. Run `pnpm check:full` on the documentation-refreshed final candidate.
2. Build/sync/install the debug APK on the connected Samsung SM-S906B using the repository Android workflow.
3. Cold-start and visually inspect Rules, Plugs, Thermometers, Settings, climate/time editors and rule details on the physical phone; capture screenshots and fix any real overflow, safe-area, spacing, touch-target or navigation issues found.
4. Run the final available Shelly hardware smoke with the configured local environment, if present. Any relay exercise must end with an explicit verified OFF state.
5. Record the exact final SHA and acceptance evidence. Do not merge to `main` as part of this branch task.
