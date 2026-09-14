# Main UX visual reference — 2026-09-14

These screenshots are the canonical visual/interaction reference for the UX restoration pass.

- Source branch: `main`
- Source SHA: `56a90240029ce19690e96ad02057cc4150ba537f`
- Physical device: Samsung SM-S906B (`RFCT70L7E8J`)
- Capture method: installed Android app + WebView DevTools navigation + physical `adb screencap`
- App data was preserved; no uninstall/clear was performed.

Important: this directory is a **visual reference only**. The old `main` domain/storage architecture is not a reference for implementation. UX restoration must stay on the refactored device/rule branch and must not reintroduce `InstalledAutomation`, the persisted hardware setup draft, or legacy setup/runtime ownership.

`android/*.txt` contains the visible text at capture time and is included only to make the reference searchable. `manifest.json` records the exact source SHA and capture list.

The older working audit under `artifacts/ui-audit/` was removed when this canonical set was created. Play Store assets under `assets/play-store/` are release collateral and are intentionally retained; they are not the canonical UX restoration reference.
