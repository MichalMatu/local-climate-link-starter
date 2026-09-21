# Next chat handoff — Slice 3C integrated, CI green, Slice 4A next

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Immediate state

Slice 3C — Shelly Cloud enable/disable — is complete and integrated on `main`.

```text
integrated main head: b2ec80d70afc3360cf7bbc33bb8907f6f20d5890
accepted product head: 47e047cc8b748725b952f14f04ad46c7f8f11023
focused validation: 20260921-slice3c-focused-v2 — success
hardware smoke: 20260921-slice3c-hardware-smoke-v1 — success
accepted final full check: 20260921-slice3c-final-v2 — success
main CI run: 35591819583 — success
CI job: 106307684252 — success, including Responsive smoke
Sandbox Pack run: 35591819763 — success
Sandbox Pack job: 106307685428 — success
completed work branch: work/plug-cloud-settings
branch cleanup: deferred; available GitHub connector has no delete-ref action and raw delete-push was not used
```

Do not resume Slice 3C product work unless new evidence shows a regression. The active next goal is Slice 4A: a bounded real-hardware BLE feasibility and protocol spike. Do not implement a production BLE transport until that spike establishes the actual protocol and capability matrix.

## Completed Slice 3C contract

Target capability:

```text
Cloud.GetConfig
Cloud.GetStatus
Cloud.SetConfig { config: { enable: boolean } }
```

Ownership and invariants:

- `@lcl/shelly-client` owns typed Cloud config/status parsing, method capability detection and the narrow enable-only mutation.
- `apps/mobile/src/features/plugs` owns the separate Cloud data/flow/card path with TanStack Query.
- Every Cloud read/write verifies live `Shelly.GetDeviceInfo.id` against the saved stable `deviceId` before creating the Cloud client.
- `baseUrl` remains reachability only.
- `Cloud.SetConfig` writes only `config.enable`; it does not emit server, relay, LED, button, automation, Wi-Fi or BLE config.
- The shared verified Plug-settings helper owns transport + identity verification only; it does not absorb product semantics.
- Cloud, button and LED settings remain separate feature families; no generic settings manager or raw JSON editor was introduced.
- User copy explicitly states that Local Climate Link does not require Shelly Cloud.
- No production dependency, lockfile, architecture-baseline, automation-runtime or BLE-transport change was introduced.

## Verification evidence

Focused validation on `47e047cc8b748725b952f14f04ad46c7f8f11023`:

```text
Cloud package tests: 4/4 passed
Cloud card tests: 2/2 passed
packages/shelly-client typecheck: passed
apps/mobile typecheck: passed
quality:repo: passed
responsive Playwright: 4/4 passed
viewports: 360x800, 390x844, 768x1024
mutation assertion: Cloud.SetConfig writes only { config: { enable } }
```

Real hardware smoke:

```text
task: 20260921-slice3c-hardware-smoke-v1
URL: http://192.168.0.10/
deviceId: shellyplugsg3-e4b063d7f530
model: S3PL-00112EU
firmware: 1.7.5
initial/final Cloud enable: false
initial/final Cloud connected: false
mutation: idempotent setEnabled(false) only
Cloud server: unchanged
relay: OFF before/after
PLUGS_UI config: unchanged
```

The hardware smoke deliberately did **not** enable Shelly Cloud because that would create an external cloud connection. The `enable=true` path is covered deterministically by the typed client, component test and responsive Playwright test.

Accepted final validation and integration:

```text
task: 20260921-slice3c-final-v2
checked product head: 47e047cc8b748725b952f14f04ad46c7f8f11023
pnpm check: success
elapsed: ~95 s
working tree after check: clean
final docs/integration head: b2ec80d70afc3360cf7bbc33bb8907f6f20d5890
main CI: 35591819583 / 106307684252 — success
Responsive smoke: success
Sandbox Pack: 35591819763 / 106307685428 — success
```

The final integration documentation commit after the accepted product check is docs-only and intentionally did not trigger a second local full `pnpm check`.

## Exact next work — Slice 4A BLE feasibility and protocol spike

1. Fetch fresh `main` and verify the Local Agent daemon is idle and still bound to this repository.
2. Read root/nearest `AGENTS.md`, this handoff, the active implementation plan, architecture boundaries and existing BLE-related code/tests before changing anything.
3. Perform a preimplementation ownership/transport audit first; Slice 4A is evidence gathering, not permission for speculative product refactors.
4. Use the real Plug S Gen3 to establish BLE discovery/connection behavior, GATT services and characteristics, authentication/pairing requirements, request/response framing and fragmentation, payload/operation limits, timeout/retry/disconnect behavior and Wi-Fi provisioning viability.
5. Probe which existing Local Climate Link operations are realistically available over BLE, beginning with low-risk reads. Record exact method/config support rather than assuming parity with HTTP.
6. Produce a capability matrix and explicit transport constraints before creating a production `ShellyRpcTransport` implementation for BLE.
7. Keep stable physical `deviceId` as identity; BLE address/session details are reachability/session data only.
8. Do not pull Slice 4B implementation forward until 4A evidence is complete and reviewed.
9. `work/plug-cloud-settings` remains cleanup debt because current safe tooling cannot delete the branch; do not bypass that limitation with raw delete-push.

## Local Chat Bridge identity

```text
repository id: local-climate-link-starter
repository: MichalMatu/local-climate-link-starter
agent_binding: e75c77cb-7589-4452-94b2-decc97ff85a1
control branch: agent-control
managed workspace: /Users/michal/agent-workspace/repos/local-climate-link-starter/work
```

Every Local Agent task for this repository must contain exactly:

```json
"agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1"
```

## Product invariants

```text
physical Plug -> optional installed automation
bottom navigation: Plugs | Thermometers | Settings
phone: configure/manage/diagnose
Shelly: execute installed automation locally
```

Keep these invariants:

- a saved Plug remains useful without automation;
- `InstalledAutomation` is durable managed-automation ownership;
- one Plug relay has one managed automation owner at a time;
- Forget Plug is local-only and is not Uninstall Automation;
- explicit uninstall preserves managed-identity verification and safe OFF;
- stable Shelly `deviceId` is physical identity;
- IP / `baseUrl` is reachability only;
- future BLE is another transport under the same Shelly client/product behavior.

## Canonical docs

```text
AGENTS.md
apps/mobile/AGENTS.md
apps/mobile/src/features/AGENTS.md
packages/AGENTS.md
docs/HANDOFF_NEXT_CHAT.md
docs/implementation/automation-recovery-editing-shelly-transport-plan.md
docs/architecture/overview.md
docs/architecture/refactor-boundaries.md
docs/architecture/feature-boundaries.md
docs/testing/hardware-matrix.md
scripts/quality/architecture-baseline.mjs
```

Historical plans are reference only. Current code + canonical docs + the active execution plan win on conflict.
