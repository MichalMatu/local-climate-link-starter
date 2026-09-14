# Refactor boundaries

This document records the current product boundaries after the device/rule decoupling work. File size is a warning signal, not a refactor goal by itself. Split code at a real responsibility boundary and keep screens focused on orchestration and presentation.

## Product model boundary

Plugs, thermometers and rules are independent durable entities.

- Plug persistence and mutations live under `flows/devices/plugs`.
- Sensor persistence and live-management orchestration live under `flows/devices/sensors`.
- Desired rule configuration, deployment metadata, lifecycle transactions and runtime ownership live under `flows/rules`.
- `flows/registry/devicesAndRules.ts` composes the independent registries and supplies cross-registry read boundaries.

A sensor is never plug-owned. Durable plug/sensor association exists only through a climate rule. Rule/device names are independent and mutable without changing the other entity's identity.

## Screen and flow boundary

Screens own route-level composition, dialogs and user interaction. They do not own RPC protocols, persistence transactions or rule deployment algorithms.

- `AutomationDashboardScreen` renders current rules from the Rule registry.
- `RuleDetailScreen` presents runtime state and dispatches lifecycle actions by `ruleId`.
- `RuleEditorScreen` composes the pure rule editor state with `useRuleEditorFlow`.
- `PlugManagementScreen` and `SensorManagementScreen` expose independent device management.
- `AppRoutes` owns the four top-level product sections: Rules, Plugs, Thermometers and Settings.

Flow hooks may orchestrate queries/mutations and narrow UI state, but business transactions remain in focused service/lifecycle modules. Avoid god hooks and large compatibility façades.

## Plug-operation boundary

`flows/devices/plugs/operations.ts` provides the shared per-physical-plug queue. Plug management and rule lifecycle mutations resolve the latest registry state after entering that queue so endpoint changes or ownership changes cannot be bypassed by stale inputs.

Direct relay control is fail closed: inventory must be readable, physical identity must match, and no rule may own the relay. Failed command verification forces OFF and rereads the output.

## Rule lifecycle boundary

`flows/rules/lifecycle.ts` is the product transaction boundary for create/deploy/verify/edit/redeploy/pause/resume/recover/delete and climate manual relay control.

Desired configuration and deployment state remain distinct. A successful remote mutation is not enough when the local deployment attachment fails; recovery must leave a truthful undeployed local state and best-effort remove the new remote artifact.

Exactly one rule may own a `(plugId, relayId)` pair. Product flows must use the live ownership resolver instead of relying on persistence alone.

## Climate runtime boundary

Climate AUTO/MANUAL is an in-process runtime state stored in `R.m`. Normal mode switching keeps the exact managed script running.

- AUTO permits automatic relay decisions.
- MANUAL keeps runtime/diagnostics alive, blocks automatic output and requires OFF before manual control is exposed.
- Unknown/unreadable mode fails closed and is never coerced to AUTO.
- BLE discovery preserves and restores the exact prior mode after cleanup.
- Climate deployment is incomplete until exact script identity/hash and safety state are verified.

Transport/status parsing, runtime ownership and lifecycle transactions stay in their dedicated modules; do not fold them into screen components.

## Time runtime boundary

Time rules own native Shelly Schedule jobs through exact job ids recorded in deployment metadata. Creation, pause/resume, edit/redeploy and deletion are transactional and verify exact schedule ownership.

Climate active-hours constraints are not native time-rule ownership; they remain inside the generated climate runtime.

## Hardware helper boundary

The old persisted hardware-setup draft and setup façade are gone. Surviving `flows/hardware-setup` modules are narrow helpers for discovery, diagnostics, validation and transient device contracts. `draftDevices.ts` contains transient contracts only and must not become a durable store.

No compatibility reader, dual write or adapter may recreate the removed installation/draft persistence path.

## Safety-sensitive boundaries

Structural cleanup must preserve behavior:

- OFF-first relay safety and verified final OFF after destructive/hardware tests,
- exact physical identity before plug mutations,
- exact rule/script/schedule ownership before runtime mutation,
- fail-closed behavior for incomplete or unreadable inventory/mode state,
- cleanup of temporary BLE discovery before restoring climate mode,
- typed persistence/hardware failures visible to the UI rather than inferred from mutation completion.

## Regression gates

`pnpm quality:repo` protects architecture and repository budgets; `pnpm quality:ux` protects feedback/modal/design-system contracts. Final acceptance requires formatting, lint, both quality gates, typecheck, tests, core coverage, build and responsive E2E via `pnpm check:full`.
