# Shelly Script examples

This directory is intentionally small in the starter pack.

The first generated examples are:

```text
xiaomi-bthome-heating.generated.js
tp357-heating.generated.js
```

Do not hand-maintain production script code here as the source of truth.

Rules:

```text
JSON config is source of truth.
script-generator creates deterministic Shelly Script.
examples may contain generated snapshots for review only.
installed climate automation uses one stable climate-engine-v1 body with parser/rule selection in compact config.
Xiaomi support uses a compact local BTHome v2 parser because tested Shelly Plug S Gen3 firmware did not expose global BTHome.
TP357 support uses the MatrixHub manufacturer-data parser model inside the same stable engine body.
BLE discovery is temporary setup code and should be stopped/deleted after scan.
```
