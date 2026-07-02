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

Generated runtime scripts are sensor-specific minimal variants:

- `xiaomi-bthome-minimal` includes only the compact BTHome v2 parser needed for packet id, battery, temperature, humidity, voltage skip, short humidity, and short temperature; it does not include the TP357 parser.
- `tp357-minimal` includes only the TP357 manufacturer-data parser and does not include BTHome code.
- `discovery-debug` is a temporary scanner script for setup, not the final runtime automation.

Shelly Plug S Gen3 firmware `1.2.3-matter22` was tested without a global
`BTHome.parseData`, so the runtime does not depend on that helper.

Tests cover deterministic output, generator-to-decoder runtime round trips, failsafe sections, strict script byte budgets, invalid config, unreplaced placeholders, Xiaomi short BTHome objects, Xiaomi composite temperature/humidity windows, and snapshots for Xiaomi and TP357 minimal runtime profiles.

Do not import UI components, app screens, Capacitor, or Shelly clients here.
