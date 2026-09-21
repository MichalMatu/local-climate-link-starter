# Next chat handoff — Slice 3C complete, integration pending

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Immediate state

Slice 3C — Shelly Cloud enable/disable — is implemented and fully validated on `work/plug-cloud-settings`.

```text
base main: c19014c0c14ce8e136c3bb149860a324320388bb
work branch: work/plug-cloud-settings
accepted product head: 47e047cc8b748725b952f14f04ad46c7f8f11023
focused validation: 20260921-slice3c-focused-v2 — success
hardware smoke: 20260921-slice3c-hardware-smoke-v1 — success
accepted final full check: 20260921-slice3c-final-v2 — success
integration: pending
```

Do not start Slice 4A until this exact Slice 3C tree plus docs-only finalization are fast-forwarded to `main` and GitHub CI / Sandbox Pack are green.

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

Accepted final validation:

```text
task: 20260921-slice3c-final-v2
checked product head: 47e047cc8b748725b952f14f04ad46c7f8f11023
pnpm check: success
elapsed: ~95 s
working tree after check: clean
```

Documentation finalization after that check is docs-only and intentionally does not trigger a second local full `pnpm check`.

## Exact remaining work — Slice 3C

1. Review the complete diff from `c19014c0c14ce8e136c3bb149860a324320388bb` to the final docs head; require clean fast-forward ancestry and only expected code/test/docs files.
2. Fast-forward `main` to the final docs head without force.
3. Verify GitHub CI, including Responsive smoke, and Sandbox Pack for the exact main SHA.
4. Delete `work/plug-cloud-settings` only if available tooling supports safe branch deletion; otherwise record cleanup debt and do not bypass safety controls.
5. Only after green main begin Slice 4A.

## Next slice — 4A BLE feasibility and protocol spike

Use the real Plug S Gen3 to establish BLE discovery/connection, GATT services and characteristics, authentication/pairing requirements, request/response framing and fragmentation, payload/operation limits, timeout/retry/disconnect behavior, Wi-Fi provisioning viability and which existing Local Climate Link RPC/config operations are practical over BLE.

Record a capability matrix before implementing a BLE transport. Do not assume HTTP/BLE parity and do not refactor product flows speculatively.

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
