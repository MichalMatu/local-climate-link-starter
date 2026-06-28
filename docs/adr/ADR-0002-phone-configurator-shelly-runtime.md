# ADR-0002 — Phone is configurator, Shelly is runtime controller

## Status

Accepted

## Context

The target user does not want Home Assistant, Raspberry Pi, Docker, YAML, MQTT broker, cloud, or a phone running 24/7. Background BLE automation on phones is unreliable and creates battery, permission, and OS lifecycle problems.

## Decision

The mobile app only:

```text
discovers devices
validates compatibility
generates config
generates Shelly Script
uploads script
runs safe tests
shows diagnostics/recovery
```

Shelly runs the automation locally after setup:

```text
BLE scan -> parser -> thermostat logic -> Switch.Set
```

## Consequences

Pros:

```text
Works after the phone leaves the home.
No cloud or server required.
Clear consumer promise.
Less background-permission risk.
```

Tradeoffs:

```text
Generated Shelly Script becomes safety-critical.
Shelly firmware/version compatibility must be tested.
Shelly-side discovery must be designed carefully.
```
