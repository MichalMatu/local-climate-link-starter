# UX visual contract

This contract exists to stop small layout differences from reappearing after refactors.

## Canonical audit

The 2026-09-24 Local Agent audit rendered 19 application states in Chromium. All canonical visual baselines use the shared 412×915 phone viewport.

Canonical renderer: **macOS (`darwin`)**. Direct `pnpm e2e:visual` and `pnpm e2e:visual:update` runs fail closed on other platforms. `prepush` is platform-aware: macOS runs the canonical visual contract, while Linux/CI/Raspberry Pi runs `pnpm e2e:responsive`; on non-macOS those responsive tests keep behavioral/layout coverage but skip Darwin screenshot assertions, so font rasterization differences cannot masquerade as product regressions.

Measured drift before this contract included:

- page-level H1 geometry split between 26px/31.2px and 32px with two different line-heights;
- add-device segmented tabs at 50px / radius 8 while Plug detail tabs were 54px / radius 12;
- multiple surface padding/radius signatures (`12/r12`, `16/r12`, and the Plug info framed `16/12/.../r8` pattern);
- repeated geometry rules living in screen CSS and the global mobile theme even when they represented the same interaction pattern.

These are not fixed by adding more one-off selectors. Shared interaction geometry belongs in `@lcl/ui`; product composition remains in the mobile app.

## Rules

1. `@lcl/design-tokens` owns raw values.
2. `@lcl/ui` owns reusable interaction geometry. `lcl-segmented-control` now owns add-device tabs, Plug detail tabs, and the hardware setup top navigation.
3. Mobile screen CSS may choose layout/composition and a semantic state treatment, but must not re-declare the shared geometry for migrated primitives.
   Page-title typography uses `--lcl-font-size-3xl`; spacing tokens must never participate in font-size calculations.
   Page-level H1 geometry is owned by `app-page-header`; smaller headings inside panels remain a separate hierarchy.
4. Every canonical screen state is guarded by `expectVisualScreen()` and a committed Playwright screenshot baseline.
5. Baselines are refreshed intentionally with `pnpm e2e:visual:update`, reviewed as images, then verified with `pnpm e2e:visual`.
6. Do not update snapshots to make a failing refactor green without first explaining the visual delta.
7. The accepted Climate dashboard card remains frozen unless a task explicitly changes its design.
8. Shared `Disclosure` owns collapsed visibility: the body is hidden by default and rendered as grid only under `[open]`; screen CSS must not bypass this state contract.
   Both collapsed and expanded product states are visually baseline-protected.
9. Navigation chevrons are icon components, never font glyphs such as `‹` or `›`, so their geometry is stable across browser and Android font fallback.

## Surface taxonomy

Surface differences are intentional only when they map to one of these roles:

- `demo-panel` — page-level working panel; large radius, elevated glass surface, fluid panel padding.
- `automation-card` — dashboard/detail object card; large radius, object-level density controlled by context.
- `app-settings__section` — settings group; large radius, flat surface, medium spacing/padding.
- `saved-list__item` — compact saved-device row/card; medium radius and medium density.
- `plug-detail-framed-section` — diagnostic fieldset with a title crossing the border; medium radius and asymmetric top padding are intentional.
- `installation-ble-card` — bordered list container; medium radius with clipped child rows.
- `lcl-card` — reusable package-level card primitive; do not assume it is interchangeable with every product surface.

Do not normalize these roles by copying padding/radius values between selectors. If two screens represent the same role, they must reuse the same role/class or a shared primitive. A new surface role requires an explicit visual-contract update and reviewed screenshot delta.

## Canonical states

`apps/mobile/e2e/visual-contract.ts` is the source of truth for the 19 names. New top-level screens or materially different full-screen states must be added there and receive a baseline in the same change.

## Local Agent workflow

Run visual checks locally. GitHub Actions availability is not assumed. `prepush` runs the four deterministic scenarios that cover all 19 canonical baselines.

```sh
pnpm quality:ux
pnpm e2e:visual
```

When a design change is intentional:

```sh
pnpm e2e:visual:update
pnpm e2e:visual
```
