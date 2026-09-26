# AGENTS.md — Shelly Link

This is the repository-wide operating contract for coding agents. Keep it short.
More specific `AGENTS.md` files apply inside their directories and add to this file.

## Read order

Before changing code:

1. read this file;
2. read the nearest directory-level `AGENTS.md` for the files you will touch;
3. read `docs/HANDOFF_NEXT_CHAT.md`;
4. read `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`;
5. fetch fresh `main` and `agent-control:.agent/status/daemon.json`;
6. verify that no duplicate Local Agent task is running.

Local Agent bindings are conversation-scoped runtime state. Never persist a binding in repository documentation or copy one from an older handoff; use only the fresh bootstrap supplied to the active conversation.

If historical docs disagree with current code or the canonical docs above, current code +
canonical docs win.

## Product invariants

Shelly Link is a local configurator and management app for Shelly Plugs, BLE
thermometers and Plug-owned automations.

The primary mental model is:

```text
physical Plug -> optional installed automation
```

Keep these invariants unless the user explicitly changes the product model:

- bottom navigation is `Plugs | Thermometers | Settings`;
- standalone Add Plug and Add Thermometer pages do not render page-local Back/return controls; persistent bottom navigation plus platform/browser Back own return navigation;
- a saved Plug remains useful without an automation;
- automation setup starts from a concrete Plug;
- Time is a Plug automation type, not a global dashboard section;
- `InstalledAutomation` is the durable installed-automation record;
- one Plug relay has one managed automation owner at a time;
- the phone configures, manages and diagnoses;
- the Shelly executes installed automation locally without requiring the phone or cloud;
- delete/uninstall paths preserve physical-device identity verification and safe-OFF behavior;
- during pre-release development Shelly Link has exclusive ownership of the Shelly Scripts namespace on a managed Plug: automation install/edit/recover may stop and replace all scripts, and uninstall may stop and delete all scripts after physical-device identity and safe-OFF are confirmed.

Do not make Home Assistant, MQTT, cloud services or a background phone loop required by
the default product flow.

## Preimplementation architecture gate

Do this **before writing implementation code**. For a tiny local change the answer may be
brief; for cross-file work it must be explicit.

Determine:

```text
product owner      -> which feature owns the behavior?
state owner        -> which module owns mutable/durable state?
side-effect owner  -> which adapter/client/flow owns BLE, network, storage or timers?
UI owner           -> which screen/component owns presentation?
final file layout  -> where will new/changed code live after the task?
test owner         -> which tests prove the behavior and boundaries?
```

Then check:

- Is there already one clear owner for each responsibility?
- Would the proposed change make an existing large file own another unrelated concern?
- Would a screen gain transport, persistence or domain logic?
- Would a facade gain a subsystem implementation instead of composing it?
- Would a shared component gain product-specific decisions?
- Is a new abstraction justified by a real boundary or only by line count?
- Can stale/dead code be removed in the same cohesive change?

If the target file would become less cohesive, extract the responsibility **before or as
part of the feature change**. Do not knowingly implement into the wrong owner and plan a
cleanup refactor afterwards.

Do not split files mechanically. File size is an alarm; responsibility is the boundary.

## Structural rules

Prefer one owner for each state, lifecycle and side effect.

Dependency direction:

```text
screens/routes
    -> mobile feature flows/state
        -> package APIs
            -> domain + adapters

shared UI -> design tokens
```

Repository rules:

- `packages/*` never import from `apps/*`;
- domain packages do not depend on React/Ionic;
- screens do not call raw `fetch`, Capacitor BLE or Shelly RPC;
- transport and persistence live behind clients/adapters/repositories/flows;
- UI primitives do not decide automation ownership or runtime behavior;
- avoid circular dependencies;
- avoid generic `Manager`, `Service`, `Utils` or catch-all modules when a concrete feature
  boundary exists;
- do not create a new shared abstraction for a single call site unless it protects a real
  boundary;
- prefer narrow public APIs and named exports;
- keep generated code/config separate from its source-of-truth model.

The mobile-specific organization and migration rules are in `apps/mobile/AGENTS.md`.
Package rules are in `packages/AGENTS.md`; `packages/ui` has an additional contract.

## Development mode

The project is in active pre-release development. Unless the user explicitly asks otherwise:

- do not add migrations, legacy adapters, dual schemas or compatibility aliases for
  development-only state;
- never keep compatibility solely for builds, persisted state, script names or APIs that
  were never publicly released;
- after a rename, remove the obsolete product name from active code, tests and canonical
  documentation instead of retaining aliases;
- replace an internal API/schema/route in one cohesive change and update all callers;
- prefer deleting obsolete code over maintaining parallel old/new paths;
- never weaken architecture or UX gates to keep stale structure alive.

## TypeScript and error handling

- Keep TypeScript strict.
- Avoid `any`; use `unknown` and validate external data at boundaries.
- Prefer explicit domain types and units in names.
- Prefer pure functions for decision logic.
- Use discriminated unions for meaningful state/error variants.
- Ordinary invalid external input should return a typed result/error, not crash.
- Do not silently swallow errors.
- User-facing errors must be short, actionable and free of raw stack traces.
- Never log credentials, tokens, Wi-Fi secrets or unredacted diagnostic payloads.

## Safety and hardware

Heating/runtime safety is not negotiable:

- boot safe state is OFF;
- stale sensor fails OFF;
- physical Shelly identity must be verified before destructive mutation;
- relay-control changes need focused safety tests.

For the local development Shelly test plug, the user has standing authorization to toggle
the relay ON and OFF through Shelly Link scripts or `Switch.Set` without asking
again. When hardware testing is relevant, use real transitions and leave the final relay
state explicit and known. On a Shelly Link-managed Plug, application script lifecycle is
exclusive: install/edit/recover may clear all existing scripts and install the current
runtime; uninstall may clear all scripts. Temporary BLE discovery remains a separately
orchestrated short-lived script and must restore the automation state when its flow ends.

## Dependencies and licensing

- New production dependency requires explicit user approval.
- A new dev dependency is acceptable only when it clearly improves build/test/tooling
  quality and has an acceptable license.
- Prefer MIT/BSD/Apache-2.0 dependencies.
- Do not copy third-party code without checking license/attribution requirements.

## Verification workflow

Use `pnpm`. Do not introduce npm/yarn lockfiles.

Normal implementation loop:

```text
fresh main + daemon
-> preimplementation architecture gate
-> smallest cohesive implementation
-> focused checks
-> exactly one final full pnpm check
-> commit/push
-> native/hardware smoke only when the change needs it
```

Useful root gates:

```text
pnpm format:check
pnpm lint
pnpm quality:ux
pnpm quality:repo
pnpm typecheck
pnpm test
pnpm check
pnpm check:full
```

Run the narrowest useful checks while iterating. Before declaring a coding task complete,
run one full `pnpm check`. Use `pnpm check:full` when responsive E2E is part of the
acceptance surface.

For UX/UI changes, automated unit tests alone are insufficient. Inspect the relevant real
render at representative viewports and use Playwright/responsive coverage when practical.
Canonical geometry-sensitive viewports are documented in `apps/mobile/AGENTS.md`.

If a check cannot run, report exactly what was and was not verified.

## Execution routing

Prefer direct GitHub edits when the diff is deterministic and reviewable.

Use Local Agent for local command execution, builds/tests, native Android/iOS work,
physical BLE/Shelly validation, USB/serial, signing or device-only network conditions.
Do not run a second coding agent through Local Agent. Always check the daemon first and use the exact binding from the current conversation bootstrap. Never store that binding in repository documentation.

Temporary screenshots, traces, APKs and Local Agent artifacts are not product source and
must not be committed unless intentionally promoted to a long-lived fixture.

## Documentation

Documentation is part of the implementation.

Update the canonical docs in the same change when product behavior, ownership or
architecture changes. Record durable architecture decisions in `docs/ARCHITECTURE.md`
and planned product stages in `docs/ROADMAP.md`.

Keep the active documentation set intentionally small. Historical plans and superseded
decisions belong in Git history rather than parallel current documents.

## Definition of done

A task is done only when:

- ownership remains clear after the change;
- no new god object or cross-layer shortcut was introduced;
- relevant tests cover behavior and failure states;
- architecture/UX gates remain green;
- safety behavior is not weakened;
- docs are updated when behavior or architecture changed;
- the final full check required by the task passed, or the exact blocker is reported;
- the final report states what changed and what was not verified.
