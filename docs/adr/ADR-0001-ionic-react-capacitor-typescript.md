# ADR-0001 — Ionic React + Capacitor + TypeScript

## Status

Accepted

## Context

The app must run on Android and iOS, scan BLE during setup, talk to Shelly over local RPC, generate Shelly Script, manage JSON profiles, and later possibly expose a web/demo panel.

Older research considered Flutter. The current implementation direction is TypeScript because parsers, configuration schemas, script generation, and web/demo tooling fit naturally in one language.

## Decision

Use:

```text
Ionic React + Capacitor + TypeScript
@capacitor-community/bluetooth-le
pnpm workspaces
Zod
TanStack Query
Zustand
Vitest
ESLint + Prettier
Style Dictionary
```

## Consequences

Pros:

```text
One TypeScript codebase for app, parsers, schemas, script generator, and tests.
Capacitor gives native BLE access on Android/iOS.
Ionic gives mobile UI primitives quickly.
Web preview/demo mode is straightforward.
```

Tradeoffs:

```text
Native BLE edge cases still require Android/iOS testing.
Capacitor plugins must be wrapped behind interfaces.
Some native app store requirements still require platform-specific config.
```

## Alternatives considered

```text
Flutter + Dart: good mobile stack, but weaker fit for TS script/profile/generator ecosystem.
React Native: viable, but not chosen for MVP.
Pure Web Bluetooth: rejected for iOS/product reliability.
```
