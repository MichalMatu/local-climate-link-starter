# Climate runtime control

## Runtime process vs control mode

The managed Shelly script is a long-lived runtime. `Script.List.running` describes the process only; it is not the user's AUTO/MANUAL choice.

The script keeps BLE scanning, diagnostics and sensor-derived telemetry alive in both modes:

- **AUTO** (`R.m = 0`): measurements may drive the configured relay rule.
- **MANUAL** (`R.m = 1`): measurements still update temperature, humidity, VPD and freshness, but the rule is not allowed to call `Switch.Set`.
- **stopped**: the managed script process is not running. This is a recovery state, not MANUAL.
- **missing**: the expected managed script cannot be found.

Runtime mode is read with `Script.Eval` from compact runtime state `R.m`. Older runtimes do not define `R.m`; the app treats those as upgradeable rather than inventing a manual state. `/diag` stays telemetry-only.

## Mode transport

AUTO/MANUAL uses `Script.Eval` against the exact stored script id. This keeps the generated Shelly runtime small and avoids separate HTTP control endpoints. Normal user mode changes never call `Script.Stop` or `Script.Start`.

`Script.Stop`/`Script.Start` remain valid only for installation/update, explicit recovery and deletion flows.

## Safety ordering

AUTO -> MANUAL:

1. verify exact stored-script ownership;
2. set `R.m = 1` in the live script, immediately blocking new automatic relay decisions;
3. force and confirm relay OFF twice;
4. reread diagnostics/control state and require live MANUAL + relay OFF.

The generated `sw()` callback also checks `R.md`. If an AUTO `Switch.Set` was already in flight when MANUAL was selected, its callback immediately issues OFF instead of accepting the old decision.

MANUAL -> AUTO:

1. require exact live MANUAL ownership;
2. force and confirm relay OFF;
3. clear relay/hit bookkeeping and set `R.m = 0` with `Script.Eval`;
4. reread state and require AUTO + relay OFF.

The next valid BLE measurement makes the first fresh automatic decision.

Manual ON/OFF is allowed only when the exact managed script is live, reports MANUAL and supports the runtime-mode protocol. Every command is reread and verified.

## Runtime upgrades

A running pre-mode runtime has diagnostics but no `md`. On the first control-mode action the app safely reinstalls the current generated script in place, requires the same script id, forces OFF around the upgrade and persists the new script hash. A genuinely stopped runtime is kept distinct and goes through explicit recovery.

### Resource diagnostics

The phone reads `Script.GetStatus` for the exact managed script id and `Sys.GetStatus` directly over Shelly RPC during the normal diagnostics refresh. Script `running`, `mem_used`, `mem_peak`, `mem_free`, optional CPU, and device `ram_size` / `ram_free` therefore add no code or state to the generated thermostat runtime. `/diag` remains telemetry-only. Resource parsing is best-effort and independent from climate telemetry, so missing firmware-dependent fields or a failed resource RPC do not disable otherwise-valid diagnostics or control.
