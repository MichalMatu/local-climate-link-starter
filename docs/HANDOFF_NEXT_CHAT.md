# Next chat handoff — Slice 3B implementation complete, integration pending

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Immediate state

Slice 3B implements the Plug S Gen3 physical-button input mode as a separate Plug settings family. Product code, focused tests, responsive E2E and real-hardware smoke are complete on `work/plug-button-input-mode`. Do not start Slice 3C until 3B is fast-forwarded to `main` and main CI is green.

Current work branch before this documentation commit:

```text
branch: work/plug-button-input-mode
product/test head: 64afc789ec679d7de2ab17b6fab5a588235bf238
base main: afe12b1ceafa5c5d117898379ec4068feff93058
```

## Completed Slice 3B contract

Target capability:

```text
PLUGS_UI.controls["switch:0"].in_mode
momentary | detached
```

Semantics confirmed against current Shelly documentation and real Plug S Gen3 firmware 1.7.5:

- `momentary` — the physical Plug button controls the relay;
- `detached` — the physical Plug button is decoupled from relay control.

Implemented ownership:

```text
apps/mobile/src/features/plugs
  -> focused button-mode data/flow/card
  -> shared verified Plug settings target helper
  -> @lcl/shelly-client typed PLUGS_UI API
  -> ShellyRpcTransport
```

Important invariants:

- button mode remains separate from LED settings; no generic settings manager was introduced;
- every Plug settings read/write verifies live `Shelly.GetDeviceInfo.id` against the saved stable `deviceId` before using `PLUGS_UI`;
- `baseUrl` is reachability only;
- `RpcShellyPlugsUiClient.setButtonInputMode()` writes only `controls.switch:0.in_mode`;
- LED mutations remain LED-only and now reuse the same verified-target helper;
- screens/components do not call raw RPC/fetch;
- no production dependency, lockfile or architecture-baseline change;
- BLE transport remains deferred to Slice 4A+.

The button-mode card is exposed from the saved physical Plug settings surface. The postimplementation audit deliberately did not duplicate it into installed-automation detail screens merely for symmetry with LED settings; Slice 3B is a physical Plug setting and the existing Plug settings surface is the canonical owner.

## Verification evidence

Focused package/component validation before the final selector fix passed through the repository pre-push hook, including formatting, lint, UX/repository gates, workspace typechecks/tests, coverage and builds.

Responsive button-mode E2E after the selector fix:

```text
task: 20260921-slice3b-e2e-v2
head: 64afc789ec679d7de2ab17b6fab5a588235bf238
result: 4/4 passed
viewports: 360x800, 390x844, 768x1024
mutation assertion: controls-only PLUGS_UI.SetConfig; no leds payload
```

Real hardware smoke:

```text
task: 20260921-slice3b-hardware-smoke-v1
URL: http://192.168.0.10/
deviceId: shellyplugsg3-e4b063d7f530
model: S3PL-00112EU
firmware: 1.7.5
sequence: momentary -> detached -> momentary
final mode: momentary
relay before/during/after: OFF
LED config: unchanged throughout
```

The smoke used `FetchShellyRpcTransport`, `RpcShellyClient` and `RpcShellyPlugsUiClient` from the repository rather than raw `curl`. It verified stable identity before mutation and restored the original mode in `finally`.

A pre-push hook ran a full `pnpm check` at intermediate head `880f960df0e70557202d6289d6efcf7054be6644`. Because later E2E/docs-only commits followed it, that run is supporting evidence only. The accepted final check is Local Agent task `20260921-slice3b-final-check-v1`; integration is permitted only when that task succeeds on the exact tree committed by the task. Do not run another full check unless the tree changes.

## Exact remaining work for 3B

1. Require `20260921-slice3b-final-check-v1` to succeed and use the exact SHA committed by that task.
2. Review `main...work/plug-button-input-mode`; confirm no unintended dependency/lockfile/baseline changes.
3. Re-fetch `main` and require it to remain an ancestor of the work branch.
4. Fast-forward `main` to the reviewed work head.
5. Verify GitHub CI, including responsive smoke, is green on main.
6. Delete `work/plug-button-input-mode` if the available tooling safely supports branch deletion; otherwise record cleanup debt and do not bypass safety controls.
7. Only after green main begin Slice 3C.

## Next slice after integration — 3C

Slice 3C is the next cohesive Plug settings family, but do not choose it by guesswork. First audit the real Plug S Gen3 supported configuration/method matrix and current official Shelly docs, then select one small user-visible family with clear typed ownership and reversible hardware validation. Keep one family per slice and do not create a generic JSON/settings surface.

Slice 4A remains the first BLE feasibility/protocol spike; do not pull BLE transport work forward into 3C.

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
scripts/quality/architecture-baseline.mjs
```

Historical plans are reference only. Current code + canonical docs + the active execution plan win on conflict.
