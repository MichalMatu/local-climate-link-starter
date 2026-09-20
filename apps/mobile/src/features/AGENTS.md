# AGENTS.md — mobile features

This contract applies to `apps/mobile/src/features/**` in addition to root and
`apps/mobile/AGENTS.md`.

## Purpose

A feature owns one cohesive product capability. Examples: `plugs`, `thermometers`,
`automations`, `settings`.

Do not create catch-all features such as `common`, `shared`, `core`, `misc`, `helpers` or
`utils`.

## Public API

Every feature directory must expose exactly one intentional entry point:

```text
features/<feature>/index.ts
```

Code outside the feature imports only through that public entry point. Internal
`screens/`, `components/`, `flows/`, `state/` and `data/` files are private implementation
details.

Rules:

- keep `index.ts` narrow;
- use explicit named/type exports;
- do not use wildcard `export *` barrels;
- do not expose stores, transport internals or implementation-only helpers just because a
  caller wants a shortcut;
- if another feature needs domain logic, prefer extracting that logic to the appropriate
  package instead of widening the feature API.

## Feature isolation

Features are isolated by default.

A feature must not deep-import another feature. Cross-feature dependencies are forbidden
unless they are deliberately reviewed and added to the executable feature-dependency
contract in `scripts/quality/feature-boundary-gate.mjs`; even then, imports must go
through the target feature's `index.ts`.

Prefer app-level composition:

```text
app/routes -> feature A
           -> feature B
```

instead of:

```text
feature A -> private internals of feature B
```

A feature must not depend back on legacy `src/screens`, `src/routes` or `src/flows`.
When migrating an existing capability, move the touched cohesive ownership boundary or
keep the capability in legacy structure until that can be done cleanly.

## Internal shape

Use only the subdirectories the feature needs:

```text
features/<feature>/
  index.ts
  screens/
  components/
  flows/
  state/
  data/
```

Responsibilities:

- `screens/` — feature page composition;
- `components/` — feature-specific presentation;
- `flows/` — orchestration/lifecycles;
- `state/` — feature-local state ownership;
- `data/` — repositories, adapters and feature-specific transport boundaries.

Do not create generic files named `utils.ts`, `helpers.ts`, `service.ts`, `manager.ts`,
`common.ts` or `misc.ts`. Name modules after the concrete responsibility.

## Side-effect ownership

Feature screens/components are presentation boundaries. They must not directly own:

- raw `fetch`;
- Capacitor BLE transport;
- `localStorage` / `sessionStorage`;
- Capacitor Preferences;
- durable persistence lifecycles.

Put those responsibilities in `flows/`, `state/`, `data/` or a reusable package as
appropriate.

One mutable state/lifecycle/side effect should have one obvious owner.

## Styling

Feature-specific styles stay with the feature. Do not add feature selectors to the global
`apps/mobile/src/theme/theme.css` merely because it is convenient.

Promote styling to shared UI only when the visual/interaction primitive is genuinely
cross-feature and product-agnostic.

## Tests

Keep feature tests with the feature when they test feature-local behavior. App-level
navigation/composition tests may remain in app test areas.

Tests should import the feature through the same public boundary used by production
callers unless the test intentionally targets one private unit.
