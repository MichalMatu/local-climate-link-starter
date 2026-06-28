# @lcl/ble-core

Purpose: BLE scanner ports, normalized advertisements, demo scanner, and pure parser functions.

Public API:

- `BleScanner`
- `NormalizedBleAdvertisement`
- `ParsedSensorAdvertisement`
- `parseBthomeV2Advertisement`
- `parseTp357Advertisement`
- `DemoBleScanner`
- `CapacitorBleScanner`

Examples:

```ts
import { DemoBleScanner, parseBthomeV2Advertisement } from '@lcl/ble-core';
```

Tests cover BTHome v2 fixture parsing, encrypted payload rejection, unknown object handling, negative temperature, voltage object id `0x0c`, malformed payload rejection, demo scan normalization, and TP357 manufacturer-data parsing from the MatrixHub payload model.

Do not import React, Ionic screens, Shelly client, or mobile app state here. The Capacitor adapter is only a shell in this slice.
