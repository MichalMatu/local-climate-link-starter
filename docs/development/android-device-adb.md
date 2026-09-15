# Physical Android device: ADB transport

For physical Android development and QA, prefer **ADB over Wi-Fi**. Use USB only as a fallback for recovery, pairing, or when wireless debugging is unavailable.

Current reference device:

- Samsung SM-S906B
- Android 16 / API 36
- device serial: `RFCT70L7E8J`

## Preferred: Wi-Fi ADB

The phone and Mac must be on the same LAN and Android **Wireless debugging** must be enabled.

Discover the current TLS endpoint with mDNS:

```bash
ADB=/opt/homebrew/bin/adb
"$ADB" mdns services
```

Look for the service for the device with type:

```text
_adb-tls-connect._tcp
```

For the reference phone the service name starts with:

```text
adb-RFCT70L7E8J-
```

Use the discovered `IP:port` instead of hardcoding either value:

```bash
ENDPOINT=<ip:port-from-adb-mdns-services>
"$ADB" connect "$ENDPOINT"
"$ADB" -s "$ENDPOINT" get-state
"$ADB" -s "$ENDPOINT" shell getprop ro.product.model
```

Expected state is `device` and model `SM-S906B`.

The wireless debugging port can change after a phone restart or after toggling Wireless debugging, so always rediscover it through mDNS before treating an old endpoint as authoritative.

If both USB and Wi-Fi transports are visible at the same time, target the Wi-Fi endpoint explicitly with `adb -s <ip:port> ...` or disconnect USB before device QA. This avoids ambiguous-device errors and ensures the test really uses the intended transport.

## Fallback: USB

Use USB when:

- Wi-Fi ADB is not discoverable through mDNS;
- `adb connect` fails;
- Wireless debugging needs to be paired or re-enabled;
- the phone is on another network;
- recovery/debugging requires a wired connection.

After USB recovery or pairing, switch back to Wi-Fi and verify it again with:

```bash
"$ADB" mdns services
"$ADB" connect <ip:port>
"$ADB" devices -l
```

## Operational rule

For Local Agent / physical-phone checks:

1. Prefer the `_adb-tls-connect._tcp` endpoint discovered through mDNS.
2. Verify the exact target with `adb -s <endpoint> get-state` before install, launch, screenshot, logcat, or UI automation commands.
3. Do not hardcode the wireless debugging port.
4. Use USB only as fallback/recovery.
