# Product roadmap

Updated: 2026-09-14

## Immediate priority — restore accepted UX quality

The device/rule decoupling architecture is implemented and verified, but its visual integration regressed parts of the previously accepted v2.0.10 UX. The next product pass is therefore **UX restoration, not a new feature phase**.

Use the physical old-UX reference committed on `main` under `artifacts/ux-reference/main-20260914/`. Preserve all useful behavior introduced by the refactor while restoring the calmer visual hierarchy, compact cards, three-dot detail entry, telemetry presentation, spacing, typography, modals/progressive disclosure and setup flow quality from the reference.

Do not roll back independent Plug / Thermometer / Rule registries or runtime-safety work merely to reproduce a screenshot.

### Acceptance order

1. Rules/dashboard cards and detail/menu behavior.
2. Plug management card, telemetry, ownership state and add/scan flow.
3. Thermometer card, readings/identity and rule-usage information.
4. Climate and time rule editors, including compact weekday row and HH/MM wheel picker.
5. Settings, setup modals and developer diagnostics.
6. Responsive E2E, `pnpm check:full`, then physical Samsung acceptance.

## After UX acceptance

Re-audit the roadmap from the finished product. The strongest previously identified next capability is expanded Shelly `PLUGS_UI` LED configuration using the existing typed client, without adding LED behavior to the climate runtime. Do not start that feature until the current UX restoration is accepted.

## Product invariants

- automation remains local/offline after setup,
- Shelly is the runtime controller; the phone is setup/status/management,
- one relay has one clear automation owner,
- prefer native Shelly capabilities for non-climate functions,
- keep the generated climate script small and safety-focused,
- advanced/developer information stays accessible but should not dominate normal UX.
