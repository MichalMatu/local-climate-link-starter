# Refactor boundaries

This document captures responsibility hotspots found during the v2.0.10 final
quality audit. File size is a signal, not a refactor goal by itself.

## Current outcome

`ShellySetupPage.tsx` was the clearest UI composition hotspot. Pure formatting,
add-form rendering and the saved Shelly card were extracted into
`ShellySetupPresentation.tsx`, reducing the parent from roughly 1426 to about
1030 lines without moving Shelly/BLE mutations or changing behavior.

The remaining largest orchestration hotspot is
`flows/hardware-setup/useHardwareSetupFlow.ts` (about 1660 lines in the audit).
It coordinates roughly twenty hardware mutations across Shelly control, LAN
scan, temporary Shelly BLE discovery, phone BLE, PVVX GATT, installation and
diagnostics. Because several paths enforce OFF-first cleanup and exact runtime
ownership, a broad line-count-driven split is higher risk than leaving this seam
intact.

## Preferred future extractions

Extract one responsibility at a time, with the existing public
`HardwareSetupFlow` contract preserved until callers/tests are migrated:

1. saved Shelly status/control mutations and feedback acknowledgement,
2. Shelly BLE discovery session lifecycle and cleanup,
3. phone BLE live scan plus PVVX GATT coordination,
4. installation + safe relay test + diagnostic orchestration.

Each extraction must keep cleanup ordering, exact-script/relay ownership and
existing hardware regression tests intact. Do not combine these structural
changes with new product behavior.

## UI/design-system guardrails

Production mobile TSX uses Tabler icon components for standard action icons and
must not contain hand-authored `<svg>` or ad-hoc inline `style={{...}}` blocks.
Reusable dimensions/colors belong in generated `--lcl-*` tokens or shared
classes. `pnpm quality:ux` enforces these constraints, and `pnpm tokens:build`
must not modify generated outputs when the repository is clean.

## Audit hygiene

The audit also checks for `TODO/FIXME/HACK`, `@ts-ignore`, broad `eslint-disable`,
debug `console.log/debug`, and `as any` escape hatches in production paths.
Structural refactoring is only accepted when lint, typecheck, tests and the
repository/UX quality gates remain green.
