# Handoff — close per-sensor diagnostics, then UX stabilization

Status: **2026-09-22**

## Current repository state

Repository: `MichalMatu/local-climate-link-starter`

Completed work branch:

```text
work/per-sensor-diagnostics
```

The branch was created from `main` commit:

```text
699e6ac7845838cbce114aab513d4ff73e972a1a
```

Local Agent binding:

```text
e75c77cb-7589-4452-94b2-decc97ff85a1
```

The per-sensor diagnostics slice is complete and should now be reviewed, merged to `main`, and retired. Do not add another feature to this branch.

## Completed behavior

Climate supports a maximum of 4 configured thermometers. The completed slice adds distinct Plug-side diagnostics for every configured sensor without changing aggregation or relay-safety semantics.

Final behavior includes:

- compact `/diag.d` record per configured thermometer;
- per-sensor temperature, humidity, battery, RSSI, last-seen uptime and fresh/stale state;
- explicit unseen representation with null values and `fresh=0`;
- mobile mapping by normalized physical BLE `runtimeAddress` only;
- Phone BLE and Plug BLE as live-reading sources;
- recovered/runtime identity provenance kept separate from telemetry source;
- config-only membership/reorder updates clear indexed `R.u` / `R.fc` state;
- aggregate-only older diagnostics remain backward-compatible;
- older managed runtimes lacking the current diagnostics/runtime revision upgrade only on explicit Save/Edit through the guarded replacement path;
- passive app launch, Details, Edit-open and diagnostics reads do not rewrite the managed runtime;
- generated Climate runtime is hard-limited to 8000 UTF-8 bytes.

No new mutable reading store, device identity, cloud dependency, MQTT dependency or parallel automation ownership model was introduced.

## Verification completed

Software verification passed on the completed branch, including focused generator/mobile regressions and the repository `pnpm check` gate.

Real-device acceptance passed on:

- Samsung SM-S906B / S22+, Android 16;
- Shelly Plug S Gen3 `S3PL-00112EU`, firmware 1.7.5;
- 3 TP357 thermometers + 1 Xiaomi/PVVX BTHome thermometer.

The accepted four-sensor runtime used generator `0.5.1`, generated at 7929 bytes, and exposed four independent `/diag.d` records. During the acceptance run unseen sensors first appeared as null/fresh=0 and then all four became fresh after BLE advertisements. The mobile Edit UI mapped all four rows to Plug BLE. Script memory remained within the measured hardware budget. `Schedule.List` remained empty. Exact dated evidence is in `docs/testing/hardware-matrix.md`.

The user's current live Climate configuration may legitimately differ from the four-sensor acceptance setup. Do not treat a later one-sensor configuration as a regression or automatically restore the acceptance configuration.

## Final audit / merge contract

Before merging:

1. compare the completed branch against current `main`;
2. confirm only intended diagnostics/mobile/docs/test changes are present;
3. run the final repository gate on the exact PR head;
4. open the PR against `main`;
5. review CI and merge only when green.

Two content-neutral technical commits exist on `main` from creating and deleting the same accidental Local Agent task file. Their final tree is unchanged from the prior baseline; leave those commits as-is and do not force-rewrite `main` history.

## Next work — UX corrections / stabilization

After this diagnostics PR is merged, the next task is **UX corrections/stabilization**, not Soil moisture.

Create a fresh UX work branch from the merged `main`. Scope that branch from concrete observed or user-reported UX problems in the existing product flows. Do not bundle Soil moisture, richer rule operators or another runtime architecture into the UX pass.

For UX work:

- preserve existing product/state/side-effect ownership boundaries;
- keep screens/components presentation-focused;
- do not change hardware/runtime behavior merely for visual polish;
- when a UX issue exposes a real functional bug, fix it at the existing owner boundary and add focused regression coverage;
- run `pnpm quality:ux`, the relevant responsive/render checks, and inspect affected flows on representative real/mobile viewports;
- use the S22+ for physical acceptance when the changed UX depends on native navigation, BLE, device discovery or real Shelly interaction.

The exact UX correction list should be defined from the next concrete user review rather than guessed here.

## Later roadmap

After the UX stabilization slice is complete, continue with the existing roadmap stages such as Soil moisture, richer timing/operators and advanced automation UX. Do not start those stages on `work/per-sensor-diagnostics`.
