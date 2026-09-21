# @lcl/script-generator

Purpose: deterministic Shelly Script generation from typed JSON config.

Public API:

- `ShellyThermostatConfig`
- `createDefaultShellyThermostatConfig`
- `normalizeConfig`
- `configHash`
- `generateShellyThermostatScript`
- `decodeShellyThermostatScript`

Examples:

```ts
import {
  createDefaultShellyThermostatConfig,
  decodeShellyThermostatScript,
  generateShellyThermostatScript
} from '@lcl/script-generator';

const script = generateShellyThermostatScript(createDefaultShellyThermostatConfig());
const decoded = decodeShellyThermostatScript(script);
```

Config requires `sensor.runtimeAddress`, keeps `sensor.sensorId` for app identity, validates `rule.control` thresholds, bounds `rssiMin`, and defaults `consecutiveHits` to 2. Consecutive hits confirm ON decisions; threshold OFF decisions stay immediate because OFF is the safe relay state. The default config helper exposes heating, cooling, humidifying, and dehumidifying presets.

Generated climate automation uses one stable `climate-engine-v1` runtime body. The compact typed runtime config selects the supported sensor parser (`Xiaomi BTHome v2` or `TP357`), thresholds, rule direction/metric and VPD behavior without changing the engine body. `discovery-debug` remains a separate temporary scanner script for setup, not the installed climate runtime.

The decoder also recognizes installed 0.2.x `xiaomi-bthome-minimal` and `tp357-minimal` scripts so existing managed runtimes can be recovered conservatively while the new generator emits `climate-engine-v1`.

Shelly Plug S Gen3 firmware `1.2.3-matter22` was tested without a global
`BTHome.parseData`, so the stable runtime keeps its compact local parsers and does not depend on that helper.

Tests cover deterministic output, generator-to-decoder runtime round trips, stable engine-body equality across supported sensor/VPD combinations, failsafe sections, script byte budgets, invalid config, unreplaced placeholders, Xiaomi short BTHome objects, Xiaomi composite temperature/humidity windows, TP357 parsing, legacy 0.2.x decoding and generated-runtime snapshots.

Do not import UI components, app screens, Capacitor, or Shelly clients here.
