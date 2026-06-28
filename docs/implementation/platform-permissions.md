# Platform permissions and local network notes

## Android

Android 12+ requires runtime BLE permissions:

```text
BLUETOOTH_SCAN
BLUETOOTH_CONNECT
```

Do not blindly set `neverForLocation` until tested with Xiaomi BTHome and TP357. Android documentation/plugin notes warn that some BLE beacons may be filtered when `neverForLocation` is used. For early hardware validation, prefer the safer path that keeps advertisements visible, then decide the production policy with an ADR.

Also plan for local HTTP to Shelly:

```text
http://<shelly-ip>/rpc/<method>
```

If Android blocks cleartext HTTP in the native shell, add a narrow local-network network security configuration. Do not add a blanket global cleartext exception without documenting it.

## iOS

Required:

```text
NSBluetoothAlwaysUsageDescription
NSLocalNetworkUsageDescription
```

For mDNS/Bonjour discovery, define required Bonjour service strings once the discovery plugin/approach is selected. For the first skeleton, manual Shelly IP entry is acceptable and avoids premature dependency choice.

Do not assume iOS exposes the real BLE MAC address. Treat phone scan IDs as setup-only. Runtime matching must be confirmed by Shelly-side discovery where possible.

## Web/dev preview

Web preview is for demo mode and UI tests. Do not claim Web Bluetooth is sufficient for iPhone/iOS production BLE flows.
