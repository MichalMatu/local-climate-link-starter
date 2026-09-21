# Next chat handoff — Slice 3B integrated, CI green, Slice 3C next

Updated: 2026-09-21

This is the canonical continuation state for `MichalMatu/local-climate-link-starter`.

## Immediate state

Slice 3B — Plug S Gen3 physical-button input mode — is complete and integrated on `main`.

```text
main product/docs head before this docs-only finalization: 0155d0508a05e4fea46bca89a83501a28ab8cc18
accepted final check: 20260921-slice3b-final-check-v1 (success)
main CI run: 35560026604 (success)
CI job: 106211021785 (success, including Responsive smoke)
Sandbox Pack run: 35560026593 (success)
Sandbox Pack job: 106211021856 (success)
completed work branch: work/plug-button-input-mode
branch cleanup: deferred; available GitHub connector has no branch-delete action and raw delete-push was not used
```

Do not resume Slice 3B product work unless new evidence shows a regression. The next product goal is Slice 3C: audit the real Plug S Gen3 configuration/method capability matrix plus current official Shelly documentation, then select one small user-visible settings family.

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
- LED mutations remain LED-only and reuse the same verified-target helper;
- screens/components do not call raw RPC/fetch;
- no production dependency, lockfile or architecture-baseline change;
- BLE transport remains deferred to Slice 4A+.

The button-mode card is exposed from the saved physical Plug settings surface. The postimplementation audit deliberately did not duplicate it into installed-automation detail screens merely for symmetry with LED settings.

## Verification evidence

Responsive button-mode E2E:

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

The smoke used `FetchShellyRpcTransport`, `RpcShellyClient` and `RpcShellyPlugsUiClient` from the repository, verified stable identity before mutation, and restored the original mode in `finally`.

Accepted final validation:

```text
task: 20260921-slice3b-final-check-v1
final checked commit: 0155d0508a05e4fea46bca89a83501a28ab8cc18
pnpm check: success
main CI: 35560026604 / 106211021785 — success
Responsive smoke: success
Sandbox Pack: 35560026593 / 106211021856 — success
```

This handoff update is docs-only and intentionally does not re-run `pnpm check`; the checked product tree is unchanged.

## Exact next work — Slice 3C

1. Fetch fresh `main` and verify the Local Agent daemon is idle and bound to this repository.
2. Read root/nearest `AGENTS.md`, this handoff, the active implementation plan and architecture boundaries.
3. Perform a preimplementation capability/ownership audit before changing code.
4. Read the real Plug S Gen3 method/config surface at `http://192.168.0.10/` and current official Shelly docs.
5. Choose exactly one small user-visible settings family with clear typed ownership and reversible hardware validation; do not choose by guesswork.
6. Keep the same architecture pattern: `@lcl/shelly-client` protocol owner, `features/plugs` product/UI owner, stable `deviceId` verification and narrow writes.
7. Do not create a generic settings/JSON editor and do not pull BLE transport work forward; Slice 4A remains the first BLE feasibility/protocol spike.

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
