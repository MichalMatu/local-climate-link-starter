# Android phone alpha workflow

Use the repository command below for physical Android alpha installs:

```bash
pnpm android:phone-alpha
```

## Clean-install rule

The phone-alpha workflow is intentionally destructive for `link.localclimate.app`.

Before every alpha install it always attempts:

```bash
adb uninstall link.localclimate.app
```

This clears the previous alpha application's local data and prevents an older or differently signed test build from blocking installation. Do not use the phone-alpha workflow when preserving app-local test data matters.

## Alpha signing identity

Phone-alpha/debug builds on a developer Mac use a persistent local alpha signing identity when this file exists:

`~/.local-climate-link/android/alpha-signing.properties`

`scripts/android/ensure-alpha-signing.sh` creates the local keystore and properties once, outside the repository, and reuses them on later alpha builds. The private key and passwords must never be committed or copied into Local Agent task JSON.

If the local alpha signing directory is deleted, a new alpha signing identity will be generated. The clean-install rule means installation still works, but the signer fingerprint will change.

The previously installed 2.0.8 alpha used a different Local Climate Link signing key whose private key is no longer available on the current development machine. Moving to the persistent alpha signer therefore requires one clean uninstall.

## Release signing is separate

The local alpha signer is not a Google Play/release key. Release builds continue to use the existing `LCL_ANDROID_KEYSTORE_FILE`, `LCL_ANDROID_KEYSTORE_PASSWORD`, `LCL_ANDROID_KEY_ALIAS`, and `LCL_ANDROID_KEY_PASSWORD` environment variables when all four are configured.
