# Google Play launch notes

Use this file when creating the first Play Console app and test release.

## App identity

```text
App name: Local Climate Link
Default language: English (United States)
App or game: App
Free or paid: Free
Package name / applicationId: link.localclimate.app
Current versionName: 2.0.5
Current versionCode: 20005
Privacy policy URL: https://michalmatu.github.io/local-climate-link-starter/privacy.html
Support email: meehow939@gmail.com
```

Recommended first track:

```text
Internal testing first, then closed testing.
```

For a new personal Google Play developer account, production access requires a
closed test with at least 12 opted-in testers for 14 continuous days. Start the
closed test as soon as the first signed AAB uploads cleanly.

## Release artifact

Google Play expects the Android App Bundle:

```text
artifacts/releases/v2.0.5/local-climate-link-v2.0.5-android-release.aab
```

The bundle must be signed with the upload key configured for this app. Do not
commit keystores, passwords, Play signing certificates, or generated service
account keys.

## Play App Signing

Use Play App Signing. Keep the upload key local and backed up outside the repo.
The Android build reads signing values from environment variables:

```text
LCL_ANDROID_KEYSTORE_FILE
LCL_ANDROID_KEYSTORE_PASSWORD
LCL_ANDROID_KEY_ALIAS
LCL_ANDROID_KEY_PASSWORD
```

## App content answers

Privacy posture:

```text
No account required.
No cloud service required.
No analytics SDK.
No third-party telemetry.
Diagnostics export is user-initiated and redacted by default.
```

Permissions to explain:

```text
Nearby devices / Bluetooth: foreground setup scan for supported thermometers.
Local network / Internet: direct LAN RPC to the user's Shelly plug.
Location on Android 11 and lower: legacy Android BLE scan requirement only.
No background location.
```

Data safety starting point:

```text
The app processes thermometer readings, Shelly status, and diagnostics locally.
It does not transmit this data to the developer by default.
If the user manually exports diagnostics, they decide where to share the file.
```

## Store listing draft

Short description:

```text
Local BLE thermometer + Shelly plug automation without a hub or cloud.
```

Full description:

```text
Local Climate Link configures a local automation between a supported BLE
thermometer and a Shelly Plug S Gen3. The phone is used for setup, compatibility
checks, script upload, relay testing, and diagnostics. After setup, the Shelly
script runs locally without a cloud service, Home Assistant, MQTT broker, or the
phone running in the background.

Supported MVP path:
- Xiaomi LYWSD03MMC with PVVX unencrypted BTHome v2
- TP357 custom BLE beacon
- Shelly Plug S Gen3 with Shelly Scripts enabled

Safety behavior:
- relay starts OFF
- stale sensor turns relay OFF
- max continuous ON guard for heating profiles
- safe relay test ends OFF
```
