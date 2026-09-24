# UX visual contract

This contract exists to stop small layout differences from reappearing after refactors.

## Canonical audit

The 2026-09-24 Local Agent audit rendered 17 application states in Chromium. The primary phone viewport is 412×915; the existing plain-Plug fixture remains 390×844.

Measured drift before this contract included:

- page-level H1 geometry split between 26px/31.2px and 32px with two different line-heights;
- add-device segmented tabs at 50px / radius 8 while Plug detail tabs were 54px / radius 12;
- multiple surface padding/radius signatures (`12/r12`, `16/r12`, and the Plug info framed `16/12/.../r8` pattern);
- repeated geometry rules living in screen CSS and the global mobile theme even when they represented the same interaction pattern.

These are not fixed by adding more one-off selectors. Shared interaction geometry belongs in `@lcl/ui`; product composition remains in the mobile app.

## Rules

1. `@lcl/design-tokens` owns raw values.
2. `@lcl/ui` owns reusable interaction geometry. `lcl-segmented-control` is the first migrated pattern.
3. Mobile screen CSS may choose layout/composition and a semantic state treatment, but must not re-declare the shared geometry for migrated primitives.
4. Every canonical screen state is guarded by `expectVisualScreen()` and a committed Playwright screenshot baseline.
5. Baselines are refreshed intentionally with `pnpm e2e:visual:update`, reviewed as images, then verified with `pnpm e2e:visual`.
6. Do not update snapshots to make a failing refactor green without first explaining the visual delta.
7. The accepted Climate dashboard card remains frozen unless a task explicitly changes its design.

## Canonical states

`apps/mobile/e2e/visual-contract.ts` is the source of truth for the 17 names. New top-level screens or materially different full-screen states must be added there and receive a baseline in the same change.

## Local Agent workflow

Run visual checks locally. GitHub Actions availability is not assumed.

```sh
pnpm quality:ux
pnpm e2e:visual
```

When a design change is intentional:

```sh
pnpm e2e:visual:update
pnpm e2e:visual
```
