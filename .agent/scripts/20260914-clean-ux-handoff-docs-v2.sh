#!/usr/bin/env bash
set -euo pipefail
git fetch origin agent-control >/dev/null
git show origin/agent-control:.agent/scripts/20260914-clean-ux-handoff-docs-v1.sh > /tmp/lcl-doc-clean-v1.sh
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/lcl-doc-clean-v1.sh')
s=p.read_text()
marker='# Format only documentation touched by this cleanup.\n'
extra=r'''rm -f docs/release/pre-commercial-hardening.md

cat > docs/code-review-checklist.md <<'EOF'
# Code review checklist

Use this for product changes before integration. `AGENTS.md` and automated quality gates remain authoritative.

## Architecture and state

- Screens orchestrate/present; they do not own persistence transactions, Shelly RPC protocols or BLE adapters.
- Plugs, thermometers and rules remain independent registries.
- A climate relationship exists through a rule, never by making a sensor plug-owned.
- One `(plugId, relayId)` has at most one rule owner.
- No legacy setup/installation storage reader, migration or dual write is introduced.
- Remote success is not reported when local persistence/attachment fails.

## Shelly/runtime safety

- Physical device identity is verified before mutation.
- Mutations serialize through the per-plug queue when required.
- Direct relay control fails closed when ownership/inventory is unknown.
- Climate AUTO/MANUAL uses the exact managed script `R.m` protocol; unknown mode never becomes AUTO.
- Normal mode changes do not stop/start the climate script.
- BLE discovery preserves the exact prior mode and leaves the relay OFF on failure.
- Destructive script/Schedule cleanup proves exact ownership first.
- Every hardware/safety test ends with an OFF attempt and read-back verification.

## BLE and parsing

- External payloads are bounds-checked and malformed fixtures exist.
- Xiaomi/PVVX and TP357 parser/runtime behavior remains aligned with committed fixtures.
- Phone scan IDs are not assumed to be stable runtime MACs on platforms that do not expose them.
- Raw payloads/secrets are not logged or exported by default.

## UI/UX

- Current top-level IA stays Rules / Plugs / Thermometers / Settings.
- Main summaries prefer saved human names; technical IDs live in detail/diagnostics.
- Loading/empty/error/blocked states are explicit and do not shift critical controls unnecessarily.
- Modals have one task; avoid nested modal chains.
- Advanced/developer information uses progressive disclosure where appropriate.
- Touch targets, keyboard flow, safe areas and phone/tablet/desktop layouts have no horizontal overflow.
- Colors, spacing, radii and repeated dimensions use existing tokens/primitives where practical.

## Verification

Choose focused checks while iterating, then finish an integration batch with:

```bash
pnpm check:full
```

For Android-sensitive UI/runtime work, also build/sync/install on the physical development phone. For hardware work, run the relevant smoke from `docs/testing/hardware-matrix.md`.
EOF

cat > docs/implementation/platform-permissions.md <<'EOF'
# Platform permissions and local network

## Android

Android 12+ BLE requires runtime `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`. Android 11 and lower use the legacy location/Bluetooth permission model already capped in the manifest.

The app intentionally does not declare `neverForLocation` for `BLUETOOTH_SCAN`: supported BLE sensors depend on advertisement payload visibility. BLE data is not used to derive physical location and background location is not requested.

Shelly RPC is local HTTP:

```text
http://<local-shelly>/rpc/<method>
```

Android network-security XML cannot express a dynamic allow-list for arbitrary user-entered LAN addresses. Native cleartext support therefore remains available for the LAN transport while `@lcl/shelly-client` enforces the product boundary by rejecting non-local RPC hosts before fetch.

Before a Play release, verify the merged manifest contains the intended Bluetooth, location-capped and Internet permissions and that real-phone BLE + LAN communication still works. While target SDK is 36, do not add Android's future local-network runtime permission prematurely; add and test it before any target-SDK move that requires it.

## iOS

A future native iOS build requires at least:

```text
NSBluetoothAlwaysUsageDescription
NSLocalNetworkUsageDescription
```

Do not enable background Bluetooth for the default product model. Do not assume iOS exposes a real BLE MAC; phone scan identity is setup/discovery evidence, while the Shelly runtime address must be stable and explicitly confirmed.

Bonjour/mDNS declarations should be added only with the concrete discovery implementation that uses them.

## Web preview

Web preview supports UI/development testing. It is not evidence that production iOS BLE or arbitrary LAN RPC will work. Platform-specific hardware behavior must be verified in the native app.
EOF

cat > docs/release/store-readiness.md <<'EOF'
# Store readiness checklist

Use this only for a public release candidate. Development UX work does not need to satisfy the signing/store steps on every iteration.

## Product claims

Verify the shipped binary still matches the local-first model:

- phone manages devices/rules and diagnostics;
- climate runtime executes on the Shelly;
- time rules execute as owned native Shelly Schedule jobs;
- no account, cloud service, MQTT broker, Home Assistant instance or background phone service is required by the default flow;
- supported hardware claims match `docs/testing/hardware-matrix.md` and compatibility docs.

## Android

- `pnpm check:full` passes for the exact release source.
- release APK/AAB builds and signature verification pass with the registered Play upload key;
- merged manifest/permissions match `docs/implementation/platform-permissions.md`;
- privacy policy URL is live;
- real-phone install/upgrade, Back behavior, safe-area/system bars, BLE permissions and local Shelly networking pass;
- Rules / Plugs / Thermometers / Settings and the rule lifecycle work after relaunch;
- diagnostics export remains user-initiated and redacted.

An unsigned `assembleRelease`/`bundleRelease` proves compilation only; it is not a Play-ready artifact.

## Hardware release evidence

Before calling a candidate store-ready, rerun the relevant real-hardware smoke on the supported Shelly firmware and sensor profiles. Verify identity/ownership checks, safe climate deployment, AUTO/MANUAL semantics, BLE discovery cleanup, native time-rule ownership where used, stale/failsafe behavior and final relay OFF.

Never delete unrelated scripts or Schedule jobs to prepare a release test.

## Privacy / data safety

Validate the final dependency/binary set before completing store privacy forms. The expected posture is local processing with no analytics, third-party telemetry or diagnostic upload by default.

## iOS

Do not claim iOS support until the native Capacitor project, required usage descriptions, real-device BLE/LAN behavior and store signing are implemented and tested.
EOF

pnpm exec prettier --write \
  docs/code-review-checklist.md \
  docs/implementation/platform-permissions.md \
  docs/release/store-readiness.md

! grep -R -nE 'pre-commercial-hardening|First skeleton scope|demo setup wizard|Zustand setup draft' docs README.md AGENTS.md

'''
if marker not in s:
    raise SystemExit('insertion marker not found')
s=s.replace(marker,extra+marker)
Path('/tmp/lcl-doc-clean-v2-runtime.sh').write_text(s)
PY
bash /tmp/lcl-doc-clean-v2-runtime.sh
