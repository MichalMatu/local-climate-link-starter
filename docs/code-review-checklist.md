# Code review checklist

Use this before merging any Codex-generated change.

## Architecture

```text
[ ] Domain logic is in packages, not React screens.
[ ] No direct Capacitor BLE calls from components.
[ ] No direct Shelly RPC calls from components.
[ ] Package dependency graph follows AGENTS.md.
[ ] No circular dependencies.
```

## TypeScript

```text
[ ] strict mode passes.
[ ] No unexplained any.
[ ] External data validated with Zod or a narrow parser.
[ ] Units are in names: temperatureC, staleTimeoutSec, minChangeMs.
[ ] Ordinary invalid input returns Result, not throw.
```

## BLE/parsers

```text
[ ] Parser has valid and malformed fixtures.
[ ] Parser does not read past buffer length.
[ ] Signed/unsigned and endian behavior tested.
[ ] iOS unstable ID issue is handled.
[ ] Raw payloads are not logged by default.
```

## Shelly

```text
[ ] RPC calls have timeouts.
[ ] Script replacement stops existing script first.
[ ] Script upload supports size/chunking plan.
[ ] Safe relay test always ends OFF.
[ ] Matter-enabled state blocks install.
[ ] Script.GetStatus errors are surfaced.
```

## Script generation

```text
[ ] Script generated from JSON config only.
[ ] Same config produces same script.
[ ] Script has version and config hash.
[ ] No eval, remote code, or arbitrary user JavaScript.
[ ] Heating default cannot start ON.
[ ] Stale sensor OFF exists.
[ ] Snapshot tests updated intentionally.
```

## First skeleton scope

```text
[ ] Demo mode can complete without hardware.
[ ] Real BLE adapter is not used by default.
[ ] Real Shelly RPC is not used by default.
[ ] TP357 parser changes stay aligned between ble-core and generated Shelly Script.
[ ] Generated example scripts match the generator behavior.
```

## UI/UX

```text
[ ] Loading, empty, success, error states exist.
[ ] Polish user-facing copy is in i18n layer.
[ ] Technical details are in diagnostics, not main flow.
[ ] Critical warnings are plain language.
[ ] Accessibility labels exist for buttons and controls.
[ ] Color is not the only status indicator.
[ ] Field validation uses `field__error` with `aria-invalid` and `aria-describedby`.
[ ] Transient operation feedback uses `ToastViewport` and does not move primary controls.
[ ] Blocking install decisions, for example Matter/Scripts/BLE blockers, use a modal.
[ ] Persistent diagnostics/status use compact rows or stable panels, not transient toasts.
[ ] The same message is not duplicated across toast, modal, and inline content.
[ ] Diagnostic/status modals shrink to content; full-height modal sizing is reserved for `workspace` previews.
[ ] Info tooltips inside modals are not clipped by modal/card overflow and remain readable on phone and desktop.
[ ] New z-index and colors use design tokens.
[ ] Breakpoints and reusable layout dimensions come from design tokens.
[ ] Phone, tablet, and desktop layouts have no horizontal overflow.
```

## Security/privacy

```text
[ ] No cloud telemetry added.
[ ] No secrets or raw diagnostics uploaded by default.
[ ] Diagnostic export is redacted.
[ ] No broad cleartext network exception without ADR.
[ ] No third-party decoder code copied without license review.
```

## Verification

```text
[ ] pnpm format:check
[ ] pnpm lint
[ ] pnpm quality:ux
[ ] pnpm typecheck
[ ] pnpm test
[ ] pnpm e2e:responsive when layout or navigation changed
[ ] pnpm build when boundaries/app setup changed
[ ] docs updated when behavior changed
```
