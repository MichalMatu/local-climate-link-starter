# Platform permissions and local network notes

## Android

Android 12+ requires runtime BLE permissions:

```text
BLUETOOTH_SCAN
BLUETOOTH_CONNECT
```

Android 11 and lower may require location permission for BLE scanning:

```text
ACCESS_FINE_LOCATION up to Android 11 / API 30
ACCESS_COARSE_LOCATION up to Android 9 / API 28
```

The app intentionally does not set `neverForLocation` on `BLUETOOTH_SCAN`.
Android documentation warns that some BLE beacons may be filtered when
`neverForLocation` is used, and Local Climate Link depends on advertisement
payloads from Xiaomi/PVVX and TP357 sensors. The app does not use BLE scan data
to derive physical location and does not request background location.

Also plan for local HTTP to Shelly:

```text
http://<shelly-ip>/rpc/<method>
```

Current native Android config declares the BLE permissions explicitly and routes
cleartext policy through `res/xml/network_security_config.xml`. Android network
security XML cannot express a dynamic private-LAN CIDR allow-list for arbitrary
user-entered Shelly IPs. Because of that, the platform layer keeps cleartext
available for LAN RPC and `@lcl/shelly-client` enforces the actual product
boundary by rejecting non-local RPC hosts before any request is sent.

Before Play Store release, verify the merged release manifest contains:

```text
android.permission.BLUETOOTH_SCAN
android.permission.BLUETOOTH_CONNECT
android.permission.ACCESS_FINE_LOCATION with maxSdkVersion 30
android.permission.INTERNET
legacy Bluetooth permissions only up to Android 11
```

## iOS

Required:

```text
NSBluetoothAlwaysUsageDescription
NSLocalNetworkUsageDescription
```

For mDNS/Bonjour discovery, define required Bonjour service strings once the discovery plugin/approach is selected. For the first skeleton, manual Shelly IP entry is acceptable and avoids premature dependency choice.

Do not assume iOS exposes the real BLE MAC address. Treat phone scan IDs as setup-only. Runtime matching must be confirmed by Shelly-side discovery where possible.

Before App Store release, generate and commit the native Capacitor iOS project,
add final `Info.plist` usage descriptions, verify that background Bluetooth modes
are not enabled, and run the full setup flow on a real iPhone.

## Web/dev preview

Web preview is for demo mode and UI tests. Do not claim Web Bluetooth is sufficient for iPhone/iOS production BLE flows.
