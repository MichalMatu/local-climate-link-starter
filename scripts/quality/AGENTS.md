# AGENTS.md — quality tooling

This contract applies to `scripts/quality/**` in addition to the repository root rules.

## Ownership

Keep quality gates focused by responsibility:

- `repository-gate.mjs` — repository-wide package/layer/size/agent-contract invariants;
- `feature-boundary-gate.mjs` — mobile feature ownership, public API and legacy-to-feature migration boundaries;
- `ux-gate.mjs` — design-token, responsive and cross-screen UX contracts.

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

## Baselines and exceptions

An exception is a reviewed architecture baseline, not spare capacity.

- keep exception lists explicit and narrow;
- do not raise a budget merely to land a feature;
- when a hotspot shrinks, prefer lowering/removing its exception later;
- document non-obvious baseline changes in canonical architecture docs.

## Feature tooling

Feature boundaries are private by default. The feature gate should continue to enforce:

- one feature public `index.ts`;
- no cross-feature deep imports;
- no feature-to-feature dependency unless explicitly reviewed;
- no dependency from a feature back to legacy screen/route/flow layers;
- no unexported workspace package subpath imports;
- no raw network/BLE/storage ownership in presentation;
- no silent growth of global style dumping grounds.

Do not weaken these checks to accommodate a single implementation. Fix the ownership or
make an explicit architecture decision.

## Verification

While editing a gate, run the gate directly plus ESLint/Prettier for the changed tooling.
Before completion, run the normal repository final check.

When practical, test a new rule with a controlled negative fixture and prove that the gate
rejects the intended violation without leaving fixture files in the repository.
