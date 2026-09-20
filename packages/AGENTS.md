# AGENTS.md — packages

This contract applies to `packages/**` in addition to the repository root rules.

## Purpose

Packages own reusable domain logic, protocol/client boundaries, generated runtime logic,
diagnostics and product-agnostic UI. They must not depend on the mobile application.

Hard rule:

```text
packages/*  -X->  apps/*
```

A package public API should be small enough that callers do not need to import internal
implementation files.

## Package preimplementation gate

Before adding code to a package, identify:

```text
domain responsibility
public API
external boundary, if any
state/side-effect ownership
allowed dependencies
tests proving the contract
```

If a change adds a second unrelated responsibility to a module, create a cohesive module
or package boundary first. Do not create a new package merely to hold one helper.

## Dependency direction

Expected relationships include:

```text
automation-core  -> no React/Ionic/app dependencies
device-profiles  -> pure profile/schema data
ble-core         -> parsing/scanning abstractions; Capacitor only in adapter files
shelly-client    -> Shelly transport/RPC/install primitives
script-generator -> automation-core + device-profiles
diagnostics      -> bounded/redacted diagnostic helpers
ui               -> design-tokens
```

Rules:

- no package imports from `apps/mobile`;
- domain/runtime packages do not import React or Ionic;
- do not introduce circular workspace dependencies;
- do not reach into another package's private source path when its public API can express
  the contract;
- add a dependency only when ownership genuinely belongs across that boundary.

`packages/ui` has additional rules in `packages/ui/AGENTS.md`.

## Domain code

Prefer:

- pure functions;
- explicit inputs/outputs;
- immutable data;
- unit-bearing names such as `temperatureC`, `timeoutMs`, `humidityPct`;
- discriminated unions over boolean combinations;
- deterministic output for generators;
- `unknown` + boundary validation for external input;
- typed results for expected failure.

Do not put wall-clock reads, network calls, storage or global mutable state inside pure
domain decisions. Pass time/state in explicitly.

Generated code is not the source of truth. Store typed configuration/model data and
generate runtime text from it.

## Boundary/adapters

External protocols and platform APIs belong at narrow edges.

- Normalize external data at entry.
- Validate RPC/device responses with Zod or a narrow parser.
- Apply explicit timeouts to network/RPC work.
- Stop/clean up scans and subscriptions.
- Keep retries bounded.
- Redact logs before diagnostics leave the package.
- Keep platform-specific Capacitor BLE imports in the designated BLE adapter files.

## Safety-critical package behavior

Automation/runtime changes must preserve:

```text
boot/start -> OFF
stale sensor -> OFF
max-on guard where configured
minimum relay-change guard
verified managed identity before destructive mutation
```

`automation-core` is the source of truth for automation decisions. Do not duplicate
threshold logic in UI code or client wrappers.

`script-generator` translates the typed model into deterministic Shelly runtime code. It
must not accept arbitrary executable user input or fetch remote runtime code.

`shelly-client` owns Shelly communication. Callers should not rebuild RPC URLs or request
shapes independently.

## BLE/profile rules

BLE parsers are pure and fixture-driven.

- Normalize advertisement data at the boundary.
- Do not assume iOS exposes a stable real MAC address.
- Keep phone BLE setup-oriented; the phone is not the installed runtime controller.
- TP357 and BTHome parsing should share fixtures with generated-runtime tests where
  practical.

Profiles define capabilities/identity; they do not own screen copy or navigation.

## Public API and file layout

Prefer a package shape such as:

```text
src/
  index.ts
  model.ts
  <cohesive-domain>/
  adapters/
  __tests__/
```

Use only the directories that match real responsibilities.

- export intentional public API from `src/index.ts`;
- keep implementation details private;
- avoid catch-all `utils.ts` files that collect unrelated helpers;
- avoid a single client/parser/generator file accumulating unrelated protocols.

When a public API changes in active development, update current callers and remove the
obsolete shape in the same change unless compatibility was explicitly requested.

## Tests

Every meaningful domain/protocol change needs focused tests.

Prefer:

- table-driven edge cases for pure decisions;
- fixture tests for parsers;
- request/response shape tests for clients;
- deterministic/snapshot checks for generated runtime code;
- explicit failure/timeout/safety tests;
- redaction tests for diagnostics.

Run the affected package tests/typecheck while iterating and the repository final gate
before completion.

## Dependencies and licensing

New production dependencies require explicit user approval. Check license before adding
or copying anything. Prefer small, focused dependencies over broad frameworks for a local
utility.
