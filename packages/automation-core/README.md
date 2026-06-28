# @lcl/automation-core

Purpose: pure deterministic automation logic for thermostat and future humidistat modes.

Public API:

- `ThermostatRule`
- `AutomationState`
- `evaluateThresholdDecision`
- `simulateThresholdRule`

Examples:

```ts
import { DEFAULT_HEATING_RULE, evaluateThresholdDecision } from '@lcl/automation-core';
```

Tests cover heating, cooling, humidifying, dehumidifying, optional VPD assist threshold adjustment, stale sensor OFF, boot OFF, minimum change guard, and max ON guard.

Do not import React, Ionic, Capacitor, BLE adapters, Shelly client, browser globals, or app state here.
