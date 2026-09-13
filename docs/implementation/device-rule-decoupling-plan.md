# Device and rule decoupling implementation plan

Status: implementation-ready plan  
Audited product baseline: `47116b57faba21e03276ba7185ea04c4ec50da4b` (`main`, v2.0.10 integration baseline)  
Target implementation branch: `work/device-rule-decoupling-20260913`

## 1. Goal

Refactor Local Climate Link so physical devices are first-class persistent entities and automation rules reference those devices instead of owning them.

The current architecture is installation-centric: a saved automation embeds its Shelly identity plus either climate-script metadata or time-schedule metadata. The main UI therefore cannot manage a plug unless an automation exists. This creates several real product failures:

- a Shelly can contain a stale Local Climate Link climate script while the app has no matching saved automation;
- that orphan script blocks creation of a time rule, but the time-rule flow offers no remediation;
- a saved plug without an automation has no normal place in the app for direct ON/OFF control or managed-script cleanup;
- adding/removing plugs and thermometers is coupled to the rule setup wizard;
- adding future plug or thermometer profiles will multiply cross-coupled setup state instead of extending independent device registries.

The target model is:

```text
Saved plugs --------------------\
                                 > Automation rules -> Shelly runtime resources
Saved thermometers -------------/                    (script or native schedule)

Rules do not own physical devices.
Devices do not require rules to exist.
```

For climate rules:

```text
saved plug + saved thermometer + climate rule config
    -> generated Shelly script deployment
```

For time rules:

```text
saved plug + schedule config
    -> native Shelly schedule deployment
```

The phone remains only the configurator/management UI. Runtime automation stays on Shelly.

## 2. UX constraint: preserve the work already done

Do **not** redesign `ShellySetupPage` or `SensorSetupPage` from scratch.

Their visual hierarchy, cards, forms, modals, network scan, BLE scan, live sensor metrics, edit/delete affordances and styling should be reused as much as possible. The refactor is primarily about routing, persistence, ownership, flow composition and runtime semantics.

The desired top-level navigation is:

```text
Rules | Plugs | Thermometers | Settings
```

`Climate` and `Time` become rule types rather than top-level device/system categories. Existing climate/time cards and detail UI can be reused inside the Rules section.

The `+` action in Plugs opens the existing Shelly add experience. The `+` action in Thermometers opens the existing sensor add experience. The `+` action in Rules chooses the rule type and then chooses already saved devices.

Avoid broad CSS churn. Keep existing class names/components where practical and only adapt layout required for the four-item bottom navigation and standalone screens.

## 3. Current architecture findings

### 3.1 `InstalledAutomation` mixes four responsibilities

`apps/mobile/src/flows/installations/model.ts` currently combines:

- physical Shelly identity/address/name/model;
- desired automation configuration;
- deployed runtime identity (`script.id/hash` or schedule job ids);
- installation timestamps.

This makes an automation record the only durable representation of a device in the main app.

`findInstalledRelayOwner()` and `findRelayOwnerConflict()` then infer output ownership from those combined records. This works only while local persistence and actual Shelly runtime are perfectly synchronized.

### 3.2 Persistent device registries already exist, but inside a setup draft

`apps/mobile/src/flows/hardware-setup/setupDraftStore.ts` persists `shellyDevices` and `sensorDevices` together with selected ids, rule values and form inputs under the hardware setup draft.

This is the wrong lifetime boundary. Saved physical devices are durable product state; selected ids, thresholds and form fields are transient rule/setup state.

The current `ShellyDraftDevice.id` is effectively tied to `baseUrl` in the add flow. This is not a stable physical identity. An IP change can create a duplicate logical plug.

### 3.3 Time automation reproduces the reported orphan-script dead end

`apps/mobile/src/flows/time-automation/useTimeAutomationSetupFlow.ts` checks the selected Shelly and rejects installation when a Local Climate Link climate script exists. This is sensible as a safety conflict, but there is no independent plug management route to remove an orphan script when no saved climate automation exists.

The result is a valid fail-closed check with no recovery path.

### 3.4 Low-level plug operations already exist

`packages/shelly-client` already supports `Switch.Set`, `Script.List`, `Script.Stop`, `Script.Delete`, schedules and status reads. The missing behavior is orchestration/model/UI, not protocol capability.

### 3.5 The hardware setup flow has two different runtime-control models

`apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts` derives `auto/manual/missing` from whether the managed script is running and switches mode using `Script.Start`/`Script.Stop`.

That is no longer the canonical climate runtime contract.

`docs/architecture/runtime-control.md` and `apps/mobile/src/flows/installations/runtimeControl.ts` define the correct behavior:

- the climate script stays running in both AUTO and MANUAL;
- AUTO/MANUAL is runtime state `R.m`, accessed with `Script.Eval`;
- normal mode changes do not stop/start the script;
- manual ON/OFF is allowed only against the exact owned climate runtime while it is in MANUAL.

Do not copy or expand the legacy `useShellyControlFlow` AUTO/MANUAL interpretation into the new plug screen.

### 3.6 Temporary Shelly BLE discovery can currently lose MANUAL mode

`prepareShellyBleDiscovery()` stops the managed climate script if it is running. Cleanup later calls `Script.Start` when it had been running.

The generated script initializes runtime state with `R.m = 0` (AUTO). Therefore a climate runtime that was live in MANUAL can be stopped for BLE discovery and then restart in AUTO.

This is a safety-sensitive bug. The refactor must preserve and restore the actual climate runtime mode, not just the process-running flag, or otherwise prevent the transition from changing user mode.

### 3.7 Adding a plug is unnecessarily coupled to scripts

`readShellySetupStatus()` performs `GetDeviceInfo`, `GetStatus` and `Script.List` together. If script APIs are missing/disabled, adding or checking a plug can fail even when the plug would still be useful for direct relay control or a native time rule.

Device registration and automation capability checks need separate boundaries:

- registration: identify/reach the physical output device and collect stable identity/capabilities;
- climate-rule compatibility: require script + BLE support and reject Matter/script incompatibility explicitly;
- time-rule compatibility: require schedule/clock/output capability, not climate-script capability;
- direct control: require switch capability only.

### 3.8 Script lookup often collapses multiple managed scripts to the first match

Several setup helpers use `find()` by `LOCAL_CLIMATE_LINK_SCRIPT_NAME`. Duplicate/stale managed scripts are possible, especially in development and after interrupted flows.

Standalone plug management must inventory exact script ids instead of pretending there can only be one. Never delete unrelated user scripts.

### 3.9 Removing a saved device currently only removes local draft state

Current `removeShellyDevice` and `removeSensorDevice` delete local setup entries and reset transient state. They do not enforce references from saved automations.

After decoupling, dangling rule references must be impossible by construction or rejected explicitly.

### 3.10 Climate install persistence happens before the safety test is the full completion gate

The climate install flow persists the installed automation after script installation, while the safe relay test is a subsequent action. This can leave a locally “installed” record after the final required safety validation has not completed successfully.

The new rule/deployment model must distinguish desired rule state from verified runtime state. A failed/incomplete safety test must not look like a fully ready automation.

### 3.11 Existing architecture budgets are hard constraints

The repository recently introduced `quality:repo` architecture budgets. Do not solve this refactor by regrowing `useHardwareSetupFlow` or the large setup pages.

Keep narrow page contracts and extract cohesive responsibilities. Update quality rules only when the architecture legitimately introduces a new boundary, never to hide a god object.

## 4. Target persistent domain model

Because the repository is explicitly in development mode, do not build backward-compatibility readers or migrations for old `lcl.hardwareSetupDraft.v8` / `lcl.installedAutomations.v1` data. Use a new schema/storage generation and allow development data reset.

### 4.1 Saved plug

Create a dedicated plugs domain under a focused app flow namespace, for example:

```text
apps/mobile/src/flows/devices/plugs/
  model.ts
  repository.ts
  store.ts
  runtime.ts
  usePlugManagementFlow.ts
```

Suggested model (exact naming may be adjusted for repository conventions):

```ts
type SavedPlug = {
  version: 1;
  id: string; // canonical normalized physical Shelly device id
  profileId: 'shelly_plug_s_gen3';
  name: string;
  baseUrl: string; // mutable endpoint, not identity
  model: string;
  gen: number;
  createdAtMs: number;
  updatedAtMs: number;
};
```

Rules:

- obtain the canonical id from `Shelly.GetDeviceInfo.id`; do not use IP/base URL as identity;
- normalize identity consistently (case-insensitive physical equality);
- rescanning the same device at a new IP updates the existing plug instead of adding a duplicate;
- do not persist automation script id on the plug record;
- runtime resources belong to rule deployment metadata/live inventory;
- device capability data may be derived live or represented as typed capability metadata, but it must not make climate-script support a prerequisite for storing a reachable plug.

### 4.2 Saved thermometer

Create a dedicated sensor registry, for example:

```text
apps/mobile/src/flows/devices/sensors/
  model.ts
  repository.ts
  store.ts
  runtime.ts
  useSensorManagementFlow.ts
```

Suggested model:

```ts
type SavedSensor = {
  version: 1;
  id: string;
  profileId: SensorProfileId;
  name: string;
  runtimeAddress: string;
  createdAtMs: number;
  updatedAtMs: number;
};
```

For the current MVP, identity can be derived deterministically from normalized profile + Shelly-side runtime address. Do not use an unstable iOS scan identifier as physical identity.

Keep live readings separate from the durable device model.

### 4.3 Automation rule

Replace the persistence meaning of `InstalledAutomation` with a rule entity that references devices.

Suggested shape:

```ts
type ClimateRule = {
  version: 1;
  id: string;
  kind: 'climate';
  plugId: string;
  relayId: number;
  sensorId: string;
  config: ClimateRuleConfig;
  deployment: null | {
    scriptId: number;
    scriptHash: string;
    safetyVerifiedAtMs: number | null;
  };
  createdAtMs: number;
  updatedAtMs: number;
};

type TimeRule = {
  version: 1;
  id: string;
  kind: 'time';
  plugId: string;
  relayId: number;
  config: DailyTimeAutomationConfig;
  deployment: null | {
    onJobId: number;
    offJobId: number;
  };
  createdAtMs: number;
  updatedAtMs: number;
};
```

Do not duplicate the full plug snapshot in every rule. Resolve `plugId` through the plug store. Resolve `sensorId` through the sensor store.

A missing referenced device is an integrity error, not a valid steady state.

The exact climate config representation may keep using the existing typed script-generator config, but avoid storing duplicated identity fields if they can drift independently from the referenced device. Build the generator input from the current rule + resolved plug/sensor at deployment time.

## 5. Reference and deletion invariants

### Physical device deletion

- deleting a plug from the app must be blocked while any rule references `plugId`;
- deleting a thermometer must be blocked while any climate rule references `sensorId`;
- show the owning rule(s) so the user can remove them first;
- do not silently cascade-delete rules or remote runtime resources in the first implementation;
- “remove device from app” must remain separate from “delete managed runtime script”.

### Rule deletion

Rule deletion owns its deployed runtime cleanup:

- climate: use exact script ownership, force/verify OFF, stop/delete exact managed script, verify absence, then remove/detach rule;
- time: disable/delete exact known jobs transactionally, force/verify OFF as current time-runtime code requires, then remove/detach rule;
- if the resource is already absent, verify that fact and permit local cleanup while preserving safe relay state;
- never delete an unrelated script or unmanaged schedule.

### Orphan runtime resource deletion

The plug screen must support deleting a live Local Climate Link climate script even when no saved rule owns it.

Implement this as an exact live-inventory operation:

1. fetch current script list;
2. identify exact script id and verify its name is an approved Local Climate Link managed name;
3. determine whether a saved climate rule owns that exact `(plugId, scriptId)`;
4. if owned, do not bypass the rule lifecycle: direct the user to delete/recover that rule;
5. if orphaned, force and verify relay OFF;
6. stop exact script if running;
7. delete exact script;
8. re-read script list and relay state; require script absent + relay OFF.

List all matching managed scripts by exact id. Do not use `find()` and delete an arbitrary first match.

Temporary `Local Climate Link BLE Discovery` scripts remain a separate cleanup category and must also never be confused with the climate runtime.

## 6. Output ownership and conflict model

For MVP, one automation rule may own one `(plugId, relayId)` at a time.

Create one pure ownership/conflict resolver used by both climate and time creation. Inputs should include:

- saved rules and deployment metadata;
- selected plug + relay;
- live managed climate scripts;
- live native schedules affecting that relay;
- rule being edited, if any.

Return a typed conflict/result rather than throwing string errors deep in UI code.

Important conflict classes:

```text
saved-rule-owner
owned-live-climate-script
orphan-managed-climate-script
unmanaged-native-schedule
stale-deployment-metadata
no-conflict
```

Semantics:

- a real saved owner blocks another rule on that relay;
- an orphan Local Climate Link script blocks deployment but has an explicit remediation path in Plug management;
- an unmanaged Shelly schedule remains protected and blocks conflicting automation;
- deployment metadata whose remote resource is verified missing must not permanently reserve the relay; mark the rule as attention/not deployed and allow recovery or deletion;
- never auto-delete a conflict as a side effect of creating another rule.

## 7. Plug runtime semantics

### No automation owner

A saved plug with no rule owning the relay must expose direct ON/OFF using `Switch.Set`.

This directly fixes the reported inability to use the plug before creating an automation.

### Climate rule owner

Do not use the legacy `useShellyControlFlow` start/stop interpretation.

Use the canonical runtime-control implementation:

- AUTO/MANUAL comes from exact rule runtime state `R.m`;
- AUTO -> MANUAL follows existing safety ordering and leaves script running;
- manual ON/OFF is allowed only when exact owned runtime is live and in MANUAL;
- AUTO raw relay control must remain blocked because the automation can immediately race it.

The plug screen can show “controlled by rule X” and route to that rule rather than duplicating climate control semantics.

### Time rule owner

Do not invent a persistent MANUAL mode for native schedules.

For this refactor, preserve the existing rule-specific time control behavior. The mandatory new direct ON/OFF guarantee is for an unowned plug. A future explicit “temporary override until next schedule event” feature can be designed separately.

## 8. Device capability separation

Split “can save this plug” from “can run this rule”.

Suggested boundaries:

### Registration check

Must prove:

- device is reachable;
- stable device id exists;
- supported output profile can be identified;
- switch status/control capability needed by the app exists.

Do not fail registration solely because `Script.List` or BLE is unavailable.

### Climate compatibility check

Must prove before climate deployment:

- supported Shelly profile/generation;
- scripts available/enabled;
- BLE available/enabled;
- Matter/script conflict handled according to current product rule;
- selected sensor profile is supported;
- runtime address is valid;
- relay ownership is free.

### Time compatibility check

Must prove before schedule deployment:

- native schedules are available;
- Shelly clock is synchronized as current runtime requires;
- relay ownership is free;
- no unmanaged native schedule conflict exists.

## 9. Preserve/fix temporary BLE discovery lifecycle

`useShellyBleDiscoveryFlow` must keep its cleanup guarantees when the Shelly page becomes standalone.

Required behavior:

- relay OFF before temporary discovery;
- clean old discovery scripts;
- suspend climate runtime only as required for BLE radio/resource sharing;
- capture the **actual climate runtime mode** before suspension;
- after discovery cleanup, restore process state and the same AUTO/MANUAL mode;
- a previously MANUAL rule must never resume as AUTO merely because discovery ran;
- if restoration cannot be verified, leave relay OFF and surface a blocking recovery state.

Add focused regression tests for MANUAL -> discovery -> cleanup -> MANUAL and AUTO -> discovery -> cleanup -> AUTO.

## 10. Screen/routing structure

Refactor `AppNavigationKind` away from `climate | time` as the global navigation identity.

Suggested top-level kind:

```ts
type AppNavigationKind = 'rules' | 'plugs' | 'sensors';
```

Settings remains a separate active nav state as today.

Suggested primary routes:

```text
rules list
automation/rule detail
rule type chooser
climate rule setup/edit
time rule setup/edit

plugs list
plug detail/add

thermometers list
thermometer detail/add

settings
```

The existing custom state router may be retained; introducing a new routing library is not required.

Update Android back-button transitions explicitly for every new route.

### Reuse current setup UI

The fastest low-risk path is to keep `ShellySetupPage` and `SensorSetupPage` presentation and progressively change the flow contracts behind them.

Do not keep them permanently embedded in one `HardwareSetupScreen` that implies Shelly -> Sensor -> Rule progression. Instead compose them as standalone pages/screens with their own lifecycle wrapper.

Move/retain lifecycle cleanup with the screen that owns the operation:

- Shelly-side BLE discovery must stop/cleanup on modal close, screen leave and pagehide;
- phone BLE scan/live saved-sensor scan must stop on screen leave;
- PVVX GATT must continue to serialize against phone BLE scans;
- do not lose cleanup merely because the visual component was reused.

The Shelly-side “scan thermometers visible to this plug” convenience may remain in Plug details initially. Saving a discovered thermometer writes to the global sensor registry only; it must not silently select it for a rule.

## 11. Rule creation UX

### Climate

1. choose rule intent/preset (temperature/humidity modes as current UI supports);
2. choose a saved plug;
3. choose a saved thermometer;
4. configure thresholds/advanced settings using the current Rule UI;
5. validate pure config;
6. resolve ownership/live conflicts;
7. deploy exact climate runtime;
8. run mandatory safe relay test;
9. mark deployment safety verified and complete setup.

If either device list is empty, provide a clear path to the corresponding Plugs/Thermometers section rather than embedding the full add wizard in the rule flow.

### Time

1. choose a saved plug;
2. configure native schedule;
3. validate clock/capabilities/conflicts;
4. create and verify the two schedule jobs transactionally;
5. persist deployment metadata.

No thermometer is involved.

## 12. Deployment state and safe relay test

Desired configuration and runtime deployment are different states.

At minimum, climate rules need to represent:

```text
configured, not deployed
deployed, safety test pending/failed
deployed and safety verified
runtime drift/missing -> attention
```

Do not present script upload success alone as fully completed climate setup.

Preserve current guarantees:

- boot OFF;
- failed install/test OFF;
- stale sensor OFF;
- max-on OFF;
- exact script ownership;
- deterministic generator hash;
- safe test final OFF.

If the safe test fails after script upload, keep enough exact deployment metadata to recover/delete the script, but show the rule as incomplete/attention rather than healthy.

## 13. Query/cache and endpoint changes

Audit all TanStack Query keys currently based on installation identity.

After decoupling:

- plug status query keys should use `plugId` plus endpoint-sensitive invalidation;
- rule runtime query keys should use `ruleId` and resolve the current plug endpoint;
- updating a plug base URL must invalidate all plug/rule runtime queries that use it;
- deleting a device/rule must remove or invalidate stale cache entries;
- foreground refresh in `AutomationDashboardScreen` must be adapted to the new query roots.

Do not cache a stale base URL inside a long-lived rule record.

## 14. Persistence strategy

Create new storage keys/schemas rather than compatibility layers, for example:

```text
lcl.plugs.v1
lcl.sensors.v1
lcl.rules.v1
lcl.ruleDraft.v1         // only if persistence of unfinished form state is still desired
```

The exact names can follow repository conventions.

Old setup/installation storage should stop being read by the new product paths. Remove dead old stores/callers once the new paths are complete. Do not keep dual-write or fallback reads.

Repository adapters must remain the only persistence boundary; do not scatter `localStorage` access into screens/hooks.

## 15. Module ownership proposal

This is a direction, not a requirement to match filenames blindly. Keep cohesive responsibilities and repository quality gates green.

```text
apps/mobile/src/flows/devices/plugs/
  model.ts                 durable plug schema/identity
  repository.ts            storage adapter
  store.ts                 Zustand registry
  compatibility.ts         registration vs rule capability checks
  runtime.ts               raw unowned relay status/control + managed inventory
  usePlugManagementFlow.ts UI orchestration

apps/mobile/src/flows/devices/sensors/
  model.ts
  repository.ts
  store.ts
  useSensorManagementFlow.ts
  readings remain separate runtime state

apps/mobile/src/flows/rules/
  model.ts                 climate/time rule union
  repository.ts
  store.ts
  ownership.ts             pure relay ownership/conflict resolver
  selectors.ts             resolve plug/sensor refs, integrity checks
  climateDeployment.ts     compose current climate install/runtime APIs
  timeDeployment.ts        compose current schedule runtime APIs

apps/mobile/src/screens/
  RulesScreen.tsx
  PlugsScreen.tsx           reuse ShellySetupPage presentation
  ThermometersScreen.tsx    reuse SensorSetupPage presentation
```

Do not move Shelly RPC into screens. Do not make `HardwareSetupFlow` the new global app state facade.

## 16. Implementation phases

Commit in reviewable vertical steps. Keep the work branch usable after each phase.

### Phase A — domain/persistence separation

- add dedicated plug, sensor and rule models/repositories/stores;
- add stable plug identity based on `deviceInfo.id`;
- add reference-integrity helpers;
- add pure ownership/conflict resolver;
- tests first/alongside implementation;
- no major visual changes yet.

Exit criteria: stores can independently persist devices and rules, stable identity tests pass, no dual legacy model is needed by new code.

### Phase B — standalone Plugs and Thermometers

- create top-level routes/screens;
- wire existing Shelly/Sensor UI to dedicated management flows;
- preserve current visuals;
- direct ON/OFF works for a saved unowned plug;
- plug managed-script inventory can identify/delete orphan LCL climate scripts safely;
- device deletion blocks when referenced;
- preserve all BLE scan/GATT cleanup.

Exit criteria: user can add/manage devices with zero rules in the app.

### Phase C — rule-centric navigation and creation

- change bottom nav to `Rules / Plugs / Thermometers / Settings`;
- adapt dashboard to Rules list;
- reuse current climate/time cards/details;
- climate rule creation selects existing plug + sensor;
- time rule creation selects existing plug;
- empty device dependencies link users to device sections;
- Android back behavior updated.

Exit criteria: no normal rule flow needs to create physical devices inline.

### Phase D — runtime ownership/recovery hardening

- make climate/time deployment consume rule references;
- integrate typed conflict resolver with actual script/schedule inventory;
- explicit orphan-script remediation;
- preserve exact owned resource ids;
- correct climate AUTO/MANUAL boundary;
- fix temporary BLE discovery mode restoration;
- model climate safety-test completion separately from raw script upload;
- keep transaction/rollback semantics for time schedules.

Exit criteria: reported orphan-script/time-rule dead end is impossible; all conflict states have deterministic remediation.

### Phase E — remove obsolete coupling and update docs

- remove obsolete `InstalledAutomation` persistence/callers once no longer needed;
- remove saved-device ownership from `hardwareSetupDraft` and leave only genuine transient draft state (or replace it entirely);
- remove legacy AUTO/MANUAL start/stop semantics from product paths;
- update `docs/architecture/overview.md`, `docs/architecture/runtime-control.md` if behavior changes, `docs/architecture/refactor-boundaries.md`, repository guide and relevant product docs;
- update architecture quality checks for the new intentional boundaries without weakening existing budgets.

Exit criteria: no production path needs the old combined installation model.

## 17. Required tests

### Pure/model tests

- plug schema/repository/store round trip;
- sensor schema/repository/store round trip;
- rule schema/repository/store round trip;
- same Shelly physical device at changed base URL updates one record;
- case normalization cannot create duplicate plug identity;
- sensor identity normalization;
- plug deletion blocked by referencing rule;
- sensor deletion blocked by referencing climate rule;
- climate/time output ownership matrix;
- stale deployment metadata vs verified missing remote resource;
- no backward-compat fallback readers.

### Runtime/service tests

- unowned saved plug ON -> verified ON;
- unowned saved plug OFF -> verified OFF;
- orphan exact managed script -> OFF -> stop/delete -> verified absent/OFF;
- unrelated user script cannot be deleted by managed cleanup;
- duplicate Local Climate Link scripts are enumerated explicitly rather than collapsed to first match;
- climate-owned script cannot be deleted as an orphan;
- native unmanaged schedule remains a conflict;
- climate AUTO/MANUAL continues to use `R.m`/exact ownership, not `Script.List.running`;
- BLE discovery from AUTO restores AUTO;
- BLE discovery from MANUAL restores MANUAL;
- failed BLE discovery cleanup leaves relay OFF and reports recovery state;
- climate safe test failure leaves rule recoverable but not healthy/complete;
- time schedule partial failure still rolls back and forces safe state.

### UI tests

- four-item bottom navigation and active states;
- Plugs empty/list/add/detail paths;
- Thermometers empty/list/add/detail paths;
- Rules empty/list/add paths;
- existing Shelly add/network-scan presentation remains functional;
- existing thermometer BLE/manual-add presentation remains functional;
- orphan script is visible/actionable from Plug management with no saved rule;
- direct ON/OFF visible with no owner;
- references block physical-device deletion with useful copy;
- climate rule device selectors use existing registries;
- time rule selector uses plug registry only;
- Android back routes for all new top-level/detail/setup states;
- all locale keys remain in parity.

### Integration/hardware scenarios

On the authorized local development Shelly:

1. reset app state; add plug only; verify ON then OFF, final OFF;
2. put a disposable `Local Climate Link Thermostat` script on Shelly with no saved rule; verify app shows it and can delete it safely, final OFF;
3. add a time rule after orphan-script cleanup; verify schedule install succeeds;
4. remove time rule; verify jobs removed but plug remains saved;
5. add thermometer independently; live reading path still works;
6. create climate rule by selecting saved plug + sensor; verify install + safe relay test + runtime status;
7. switch climate rule MANUAL, run temporary Shelly BLE discovery, close it, verify mode remains MANUAL and relay OFF;
8. remove climate rule; verify managed script removed but both plug and thermometer remain saved;
9. re-add/rescan the same Shelly at another reachable endpoint if practical; verify identity deduplicates by device id.

The local development Shelly relay is authorized for ON/OFF testing. Always leave final relay state explicitly verified OFF after safety-sensitive test sequences.

## 18. Verification policy

During each phase, run the narrowest focused tests that detect regressions in changed modules.

Before declaring the implementation complete, run:

```bash
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm quality:repo
pnpm typecheck
pnpm test
pnpm build
pnpm e2e:responsive
pnpm check:full
```

Avoid repeatedly running the full suite during small edits; one final `pnpm check:full` is required on the exact candidate SHA.

Also run focused real-hardware smoke for the relevant Shelly changes. Record exact final relay state.

Do not merge into `main` merely because code compiles. Keep implementation on the work branch until exact candidate verification is green and reviewed.

## 19. Non-goals

Do not use this refactor to:

- add broad new hardware support;
- migrate to another framework/router/state library;
- redesign the polished Plug/Thermometer UI;
- add cloud, MQTT, Home Assistant or phone-background automation;
- implement compatibility migration for old development localStorage;
- auto-delete unknown Shelly scripts/schedules;
- introduce multi-rule arbitration on one relay;
- implement time-rule temporary manual override unless needed by an existing regression requirement.

## 20. Implementation pitfalls checklist

Before every commit, explicitly check these failure modes:

- [ ] plug identity is stable device id, not IP/base URL;
- [ ] endpoint changes propagate to all runtime operations through resolution, not copied stale rule data;
- [ ] saved devices do not depend on an automation existing;
- [ ] rule records reference device ids and do not duplicate mutable device snapshots;
- [ ] deleting a local device does not silently orphan a rule;
- [ ] deleting a runtime resource cannot target an unrelated user script/schedule;
- [ ] orphan managed scripts have a recovery path without needing a saved rule;
- [ ] duplicate managed scripts are not hidden by `find()`;
- [ ] climate AUTO/MANUAL is `R.m`, not script process running/stopped;
- [ ] BLE discovery cannot turn MANUAL back into AUTO;
- [ ] direct raw relay control is not allowed to race an AUTO climate owner;
- [ ] safe relay test completion is distinguishable from script upload success;
- [ ] time schedule transaction rollback semantics remain intact;
- [ ] unmanaged native schedules remain protected conflicts;
- [ ] scans/GATT sessions are stopped on screen/modal/page lifecycle transitions;
- [ ] standalone plug registration does not require climate-script capability;
- [ ] query caches are invalidated on endpoint/device/rule changes;
- [ ] four-item bottom nav remains usable on narrow mobile viewports;
- [ ] translation key parity is maintained for all supported locales;
- [ ] `quality:repo` architecture budgets are preserved rather than loosened to hide coupling;
- [ ] final hardware relay state is verified OFF after tests.

## 21. Starting file map for the implementer

Read these before editing:

```text
AGENTS.md
docs/development/repository-guide.md
docs/architecture/overview.md
docs/architecture/runtime-control.md
docs/architecture/refactor-boundaries.md

apps/mobile/src/routes/AppRoutes.tsx
apps/mobile/src/components/AppBottomNavigation.tsx
apps/mobile/src/screens/AutomationDashboardScreen.tsx
apps/mobile/src/screens/InstallationDetailScreen.tsx
apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx
apps/mobile/src/screens/hardware-setup/pageContracts.ts
apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx
apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx

apps/mobile/src/flows/hardware-setup/setupDraftStore.ts
apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts
apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts
apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts
apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts
apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts
apps/mobile/src/flows/hardware-setup/shellyRequests.ts

apps/mobile/src/flows/installations/model.ts
apps/mobile/src/flows/installations/repository.ts
apps/mobile/src/flows/installations/store.ts
apps/mobile/src/flows/installations/runtimeControl.ts
apps/mobile/src/flows/installations/useInstalledAutomationRuntime.ts

apps/mobile/src/flows/time-automation/useTimeAutomationSetupFlow.ts
apps/mobile/src/flows/time-automation/runtime.ts

packages/shelly-client/src/model.ts
packages/script-generator/src/shelly/generate.ts
```

Then inspect tests adjacent to every file changed before choosing an implementation shape.

## 22. Execution brief for the coding model

Implement this plan on `work/device-rule-decoupling-20260913` from the current documented `main` baseline.

Do not treat this document as permission for a blind large rewrite. First inspect the exact current source/tests and preserve behavior not explicitly changed here. Use the phases above and make reviewable commits. If an implementation detail conflicts with a repository invariant in `AGENTS.md`, the repository invariant wins and this plan must be adjusted without weakening safety.

Priorities, in order:

1. physical devices must exist/manage independently of rules;
2. the reported orphan-script/time-rule dead end must have a safe deterministic recovery path;
3. unowned saved plugs must support direct ON/OFF;
4. rules must reference saved devices and own only desired config + deployment metadata;
5. preserve existing polished Plug/Thermometer UX;
6. preserve or strengthen OFF-first/exact-ownership safety;
7. fix the MANUAL/AUTO inconsistency and BLE discovery mode restoration;
8. keep architecture gates and full verification green.

When uncertain, prefer explicit fail-closed state with actionable remediation over implicit deletion, fallback identity, or guessing runtime ownership.
