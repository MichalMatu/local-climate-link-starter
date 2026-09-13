# Astra implementation handoff

Repository: `MichalMatu/local-climate-link-starter`
Required branch: `work/device-rule-decoupling-20260913`
Plan of record: `docs/implementation/device-rule-decoupling-plan.md`

## Prompt

You are the implementation worker for the Local Climate Link device/rule decoupling refactor.

Work only in `MichalMatu/local-climate-link-starter` on `work/device-rule-decoupling-20260913`. Do not merge to `main`.

Before editing, read in this order:

1. `AGENTS.md`
2. `docs/implementation/device-rule-decoupling-plan.md`
3. `docs/development/repository-guide.md`
4. `docs/architecture/overview.md`
5. `docs/architecture/runtime-control.md`
6. `docs/architecture/refactor-boundaries.md`
7. the exact current source and adjacent tests listed in the plan's Starting file map.

The plan is implementation-ready, but repository invariants and exact current code win if there is a conflict. Do not perform a blind rewrite. Implement in the plan's phases, preserving a usable branch and reviewable commits.

Non-negotiable product outcome:

- saved plugs and saved thermometers are independent first-class entities;
- rules reference saved devices rather than owning device snapshots;
- bottom navigation becomes Rules / Plugs / Thermometers / Settings;
- preserve the existing visual design of the Shelly and sensor setup screens as much as practical;
- an unowned saved plug can be controlled ON/OFF without creating a rule;
- an orphan Local Climate Link climate script is visible and safely removable from plug management without requiring a saved automation;
- climate and time rule creation select existing devices;
- rule/device deletion cannot leave dangling ownership;
- exact runtime ownership and OFF-first safety remain fail-closed;
- climate AUTO/MANUAL continues to use the canonical `R.m` runtime protocol, not `Script.List.running` or Script.Stop/Start as normal mode control;
- temporary Shelly BLE discovery must preserve the previous AUTO/MANUAL mode and never convert MANUAL to AUTO on restart;
- do not require climate-script capability merely to register/use a plug for direct control or a native time rule;
- do not add compatibility/migration layers for the old development localStorage schemas.

Implementation discipline:

- inspect adjacent tests before changing each subsystem;
- keep business/RPC logic out of React screens;
- do not regrow `useHardwareSetupFlow` or large setup pages; preserve `quality:repo` architecture budgets;
- reuse existing components/styles rather than redesigning polished device screens;
- use typed results/conflicts at boundaries and explicit stable identities;
- use Shelly device id, not base URL/IP, as plug identity;
- never silently delete an unknown script or native schedule;
- enumerate exact managed script ids; do not collapse duplicates with a first-match assumption;
- keep time-schedule transactional rollback behavior;
- keep BLE/GATT lifecycle cleanup on route/modal/page transitions;
- preserve locale key parity for all supported locales.

Verification:

- run focused tests while iterating;
- run `pnpm quality:repo` and `pnpm quality:ux` whenever architecture/UI boundaries change;
- before claiming completion run the exact final candidate through `pnpm check:full` plus any additional focused/hardware checks required by the plan;
- for local Shelly hardware smoke, relay ON/OFF is authorized for this development device; always finish by explicitly verifying relay OFF.

Continuity requirement:

Maintain `docs/implementation/device-rule-decoupling-progress.md` on this branch. Create it at the first implementation commit and update it at every meaningful checkpoint with:

- current branch HEAD;
- completed phases/commits;
- files/subsystems materially changed;
- focused checks run and results;
- hardware checks run and final relay state;
- known failures or unresolved design decisions;
- exact next implementation step.

If execution capacity/credits end before completion, commit the safest coherent state available, update that progress file, do not merge, and leave the working tree clean when possible. The next worker must be able to continue by reading the plan plus progress file without reconstructing hidden reasoning.

Start with a fresh inspection of the branch and Phase A. Do not spend a separate long turn rewriting the plan; implement it.
