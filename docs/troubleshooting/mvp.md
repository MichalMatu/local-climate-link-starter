# Troubleshooting

This document describes the current independent-device/rule architecture. Historical setup-draft and installed-automation recovery paths are intentionally omitted.

## Shelly cannot be registered or reached

Check the saved endpoint, local Wi-Fi connectivity, `Shelly.GetDeviceInfo`, model/identity match, firmware, Scripts availability, BLE capability and Matter state. LAN scan results are candidates only after device-info verification; manual address entry remains available.

Never treat a reachable IP as the device identity. Runtime mutations re-verify the physical Shelly identity before writing.

## Sensor visible on phone but not from Shelly

Check Shelly Bluetooth, sensor battery/distance, runtime BLE address/profile, RSSI threshold and advertising format. Use Shelly-side BLE discovery from the target plug.

### Shelly-side BLE discovery safety

For a deployed climate rule, discovery does **not** use normal script stop/start as a mode switch. The app reads the exact current `R.m` mode, puts the running climate runtime into MANUAL, verifies relay OFF, runs the temporary discovery scanner, cleans it up, restarts climate BLE scanning as needed, and restores the exact previous AUTO/MANUAL mode.

If the previous mode is unknown or restoration cannot be verified, fail closed and keep the relay OFF. Never guess AUTO. A climate script that was genuinely stopped before discovery remains a separate maintenance/recovery state.

## AUTO / MANUAL or manual relay control unavailable

- AUTO and MANUAL require exact managed-script ownership and readable runtime mode.
- MANUAL keeps runtime/diagnostics alive and blocks automatic relay decisions.
- Manual ON/OFF is exposed only for a verified MANUAL climate owner, or as guarded standalone plug control when no rule owns the relay.
- Unknown mode, conflicting ownership or unreadable inventory fails closed.

Normal AUTO/MANUAL changes never call `Script.Stop`/`Script.Start`.

## Climate deployment failed

Upload alone is not deployment success. Verify the current plug identity, exact script id/hash, MANUAL/OFF safety state and safety test. If persistence/attachment fails after a remote mutation, recovery must leave truthful local deployment state and best-effort clean the new remote artifact.

## Time rule failed

Time rules use native Shelly Schedule jobs. Check exact stored job ids and live ownership before edit/pause/resume/delete. Do not create a native time rule that competes with a climate rule for the same relay. Climate active hours are not native schedule ownership.

## Relay state is uncertain

Use OFF-first recovery. Send OFF, reread and verify. If OFF cannot be confirmed, report the uncertainty and do not continue with destructive/redeploy operations as if the relay were safe.

## Sensor stale / weak signal

Check battery, distance, runtime address/profile, packet freshness and RSSI. Incomplete BLE frames may update telemetry without refreshing the control measurement. Do not relax stale/RSSI safety thresholds merely to hide a real radio problem.

## Matter / Scripts / memory problems

Matter or firmware configuration may block Shelly Scripts. `Script.List` availability is a stronger capability signal than assuming a global script field exists in status. For `out_of_memory` / `out_of_codespace`, inspect exact script status and firmware, remove only owned temporary resources, and keep final relay OFF.

For detailed runtime-mode semantics see `docs/architecture/runtime-control.md`. Hardware history and firmware evidence live in `docs/testing/hardware-matrix.md`.
