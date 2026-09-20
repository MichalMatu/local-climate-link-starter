# AGENTS.md — quality tooling

This contract applies to `scripts/quality/**` in addition to the repository root rules.

## Ownership

Keep quality tooling focused by responsibility:

- `repository-gate.mjs` — repository-wide package/layer/size/agent-contract invariants;
- `feature-boundary-gate.mjs` — mobile feature ownership, public API and legacy-to-feature migration boundaries;
- `ux-gate.mjs` — design-token, responsive and cross-screen UX contracts;
- `architecture-baseline.mjs` — reviewed package DAG, legacy-path and growth baselines;
- `gate-selftest.mjs` — deterministic positive/negative regression coverage for the executable gates.

Do not turn one gate into a catch-all just because it already runs in `pnpm quality:repo`.
If a new rule belongs to a distinct architectural concern, prefer a focused gate/module.

## Gate design

A gate must be:

- deterministic;
- fast enough for normal local checks;
- read-only with respect to product source;
- explicit about the violated path and remediation;
- based on an architectural invariant, not personal formatting preference;
- baseline-compatible when introduced unless the same task intentionally fixes the violation.

Avoid rules that require network access, hardware or mutable external state.

## Architecture baselines

Reviewed mutable baselines live in `architecture-baseline.mjs` rather than being duplicated
across gate implementations.

A baseline is accepted debt, not spare capacity:

- do not raise a baseline merely to land a feature;
- new unrelated responsibility goes to a better owner instead;
- when a protected hotspot shrinks, lower its baseline in the same cohesive change when practical;
- a package or feature dependency addition is an architecture decision, not a convenience import;
- canonical architecture docs must explain non-obvious baseline changes.

Legacy mobile production paths are frozen recursively. Existing files may remain where they
are, but new product modules do not get added under legacy `screens/`, `flows/` or
`components/`; new cohesive capabilities belong under `features/<feature>`.

## Feature tooling

Feature boundaries are private by default. The feature gate should continue to enforce:

- one feature public `index.ts`;
- no cross-feature deep imports;
- no feature-to-feature dependency unless explicitly reviewed;
- no dependency from a feature back to legacy screen/route/flow layers;
- no unexported workspace package subpath imports;
- no raw network/BLE/storage ownership in presentation;
- no silent growth of global style dumping grounds;
- no bypass by nesting a new product module deeper inside a legacy directory.

Do not weaken these checks to accommodate a single implementation. Fix the ownership or
make an explicit architecture decision.

## Quality self-tests

Every new or materially changed gate rule must have a deterministic regression case in
`gate-selftest.mjs` unless the rule cannot reasonably be fixture-tested.

Self-tests must:

- exercise both legal and rejected shapes where useful;
- use temporary fixture roots only;
- leave the repository working tree untouched;
- assert the intended failure message, not merely a non-zero exit code;
- stay independent of network, hardware and mutable external state.

Run `pnpm quality:selftest` while changing gate logic. `pnpm quality:repo` also runs the
self-test suite automatically.

## Verification

While editing a gate, run Prettier/ESLint for changed tooling, the focused gate and
`pnpm quality:selftest`. Before completion, run the normal repository final check.

Do not commit temporary patchers, fixture trees, logs or audit artifacts.
