# Output compatibility

## Official MVP support

| Output             | Status | Notes                                                                                         |
| ------------------ | ------ | --------------------------------------------------------------------------------------------- |
| Shelly Plug S Gen3 | target | Stock firmware, local RPC, Scripts, BLE, local switch:0 relay. Matter must not block Scripts. |

## Current implementation behavior

```text
FakeShellyClient:
  - simulates Shelly Plug S Gen3 status
  - simulates script upload success
  - simulates Matter ON blocked state
  - runs safe relay test with final OFF

FetchShellyRpcTransport / RpcShellyClient:
  - performs local Shelly RPC through fetch
  - supports manual IP checks, LAN scan candidates, script install, diagnostics,
    script start/stop, and relay OFF commands
  - skips saved Shelly plug URLs before LAN scanning, then stops at the first
    new verified plug

Hardware setup UI:
  - can scan a local IP range for Shelly-like RPC devices
  - can upload a temporary Shelly-side BLE discovery script
  - pauses the main thermostat automation while the BLE scanner is running
  - leaves the relay OFF before scanning and restores automation only if it was running
```

## Deferred

| Output                      | Decision          | Reason                                               |
| --------------------------- | ----------------- | ---------------------------------------------------- |
| NOUS A8T / Tasmota ESP32    | later             | Valuable path but not in Shelly-first MVP.           |
| NOUS A1T / Gosund / ESP8266 | later output-only | Cannot scan BLE locally; may be remote output later. |
| ESP32 gateway / LiteGraph   | V3/pro            | Too broad for consumer MVP.                          |
