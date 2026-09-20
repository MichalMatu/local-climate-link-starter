# Feature boundaries

Updated: 2026-09-20

This document defines the executable feature-ownership contract for the mobile app.
It complements `docs/architecture/refactor-boundaries.md` and
`apps/mobile/src/features/AGENTS.md`.

## Goal

Improve structure incrementally while product work continues. Do not mass-migrate the
existing technical-layer tree.

New cohesive product capabilities belong under:

```text
apps/mobile/src/features/<feature>/
```

Existing code in `screens/`, `flows/` and `components/` remains valid until a touched
product slice has a real ownership reason to move.

## Feature shape

A feature has one narrow public entry point:

```text
features/<feature>/
  index.ts
  screens/
  components/
  flows/
  state/
  data/
```

Only create the subdirectories that are actually needed.

External callers import the feature through `index.ts`. Internal files are private.
Wildcard `export *` barrels are forbidden so the public surface remains intentional.

Catch-all feature names such as `common`, `shared`, `core`, `misc`, `helpers` and `utils`
are forbidden. Generic module names such as `utils.ts`, `helpers.ts`, `service.ts`,
`manager.ts`, `common.ts` and `misc.ts` are also rejected inside features.

## Feature isolation

Features have no dependencies on other features by default.

Preferred composition:

```text
app/routes -> feature A
           -> feature B
```

Avoid:

```text
feature A -> private file in feature B
```

A cross-feature deep import always fails. If a genuine feature-to-feature dependency is
reviewed and accepted, it must be explicitly added to the feature dependency contract in
`scripts/quality/feature-boundary-gate.mjs` and must still import only through the target
feature's `index.ts`.

Shared domain behavior should normally move to an appropriate package instead of creating
feature coupling.

A feature also cannot depend back on the legacy `src/screens`, `src/routes` or `src/flows`
layers. During gradual migration, either move the touched cohesive ownership boundary or
leave the capability in legacy structure until that can be done cleanly.

## Legacy root freeze

The current top-level production modules in:

```text
apps/mobile/src/screens
apps/mobile/src/flows
apps/mobile/src/components
```

are an explicit baseline. New top-level product modules there fail the feature gate.

This does not force existing code to move. It prevents the old structure from continuing
to expand horizontally. A genuinely cross-feature mobile component may be added only by
an explicit architecture change to the baseline; a new product capability belongs in a
feature.

## Package public APIs

Imports from `@lcl/*` packages must respect each workspace package's
`package.json#exports` map.

Allowed examples:

```text
@lcl/ui
@lcl/ui/styles.css
@lcl/design-tokens/styles.css
```

An unexported deep import such as `@lcl/shelly-client/src/...` fails the gate. If a caller
needs new package behavior, export it intentionally through the package public API rather
than reaching into implementation files.

## Side-effect ownership

Presentation code in legacy screens/components and feature screens/components must not
directly own:

- raw `fetch`;
- Capacitor BLE transport;
- `localStorage` or `sessionStorage`;
- Capacitor Preferences.

Those responsibilities belong in feature `flows/`, `state/`, `data/` or a reusable
package boundary.

## Styling boundary

Feature-specific CSS should stay with the feature rather than grow the global theme.

The feature gate currently protects these shared stylesheet baselines:

```text
apps/mobile/src/theme/theme.css   3334 lines by the gate parser
packages/ui/src/styles.css         750 line guardrail
```

The `theme.css` value is a freeze of the current parser count, not spare capacity. The
parser uses `split('\n').length`, which is one greater than `wc -l` for the current
newline-terminated file.

If reusable UI styling grows beyond the `@lcl/ui` shared-style budget, split cohesive
primitive styles instead of increasing a global dumping ground.

## Executable enforcement

`pnpm quality:repo` runs:

```text
scripts/quality/repository-gate.mjs
scripts/quality/feature-boundary-gate.mjs
```

The feature gate enforces:

- mobile root-directory shape;
- legacy top-level module freeze;
- feature naming and public API shape;
- feature isolation and private internals;
- reviewed feature dependency direction;
- package export surfaces;
- presentation side-effect boundaries;
- shared stylesheet budgets;
- presence of the feature-level `AGENTS.md` contract.

Do not weaken a gate because a feature was implemented in the easiest location. Fix the
ownership or make an explicit architecture decision and document why the contract needs
to change.

## Phase 2 baseline

Phase 2 introduced these guardrails without moving or refactoring product code. The
purpose is to make future feature work improve the architecture naturally as touched
slices evolve.
