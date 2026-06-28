# ADR-0005 — No cloud, Home Assistant, or MQTT in default MVP flow

## Status

Accepted

## Context

The target user explicitly does not want Home Assistant, a server, MQTT broker, Docker, YAML, or cloud dependencies.

## Decision

Default MVP flow must work locally:

```text
BLE sensor -> Shelly Script -> local relay
```

No default dependency on:

```text
cloud
Home Assistant
MQTT broker
external webhook
phone background service
```

## Consequences

Pros:

```text
Simple consumer promise.
Works offline after setup.
Lower support burden for non-technical users.
```

Tradeoffs:

```text
Advanced integrations are deferred.
Diagnostics must be strong because no HA dashboard exists.
```
