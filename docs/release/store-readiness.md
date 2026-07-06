# Store readiness checklist

Local Climate Link is local-first: the phone configures the setup and Shelly runs
the automation locally. This checklist must pass before a public commercial store
release.

## Native projects

Android:

- Build the release variant.
- Inspect the merged manifest.
- Confirm the public privacy policy is live at
  `https://michalmatu.github.io/local-climate-link-starter/privacy.html`.
- Confirm BLE permissions match the platform notes.
- Confirm location permissions are capped to Android 11 and lower and no
  background location is requested.
- Confirm local Shelly HTTP still works through `CapacitorHttp`.
- Confirm `@lcl/shelly-client` rejects non-local RPC hosts before fetch.
- Use `docs/release/google-play.md` for Play Console app creation values.

iOS:

- Generate and commit the Capacitor iOS project.
- Add `NSBluetoothAlwaysUsageDescription`.
- Add `NSLocalNetworkUsageDescription`.
- Do not enable background Bluetooth modes for the MVP.
- Test on a real iPhone.
- Confirm phone BLE scan is setup-only and Shelly-side discovery remains the
  authoritative runtime address source.

## Review notes

Use review notes close to this:

```text
Local Climate Link configures one Shelly Plug S Gen3 and one supported BLE
thermometer on the user's local network. The phone is not the runtime
controller. Bluetooth is used only during foreground setup. Local network access
is used only for direct communication with the local Shelly RPC and diagnostics
endpoints. No account, cloud service, MQTT broker, or Home Assistant instance is
required. The relay safety test briefly toggles the Shelly relay and ends OFF;
reviewers should test without a heater or other load attached.
```

Supported hardware for the MVP:

```text
Shelly Plug S Gen3 on stock firmware
Xiaomi LYWSD03MMC with PVVX unencrypted BTHome v2 preset
TP357 custom BLE beacon
```

## Privacy / data safety

The expected public posture is local processing only, with no analytics,
third-party telemetry, cloud account, or diagnostic upload by default. Validate
this against the final binary and all bundled SDKs before completing App Store
privacy labels or Google Play Data safety.

Diagnostics export must stay user-initiated and redacted by default.

## Hardware release evidence

Do not mark a build store-ready until `docs/testing/hardware-matrix.md` has dated
release-candidate rows for:

- Xiaomi/PVVX BTHome v2 setup and runtime.
- TP357 setup and runtime.
- Shelly reboot safe OFF.
- Relay ON and relay OFF for the selected rule modes.
- Stale sensor OFF.
- Max ON OFF.
- Diagnostics redaction.
- Final relay state OFF after every test.
