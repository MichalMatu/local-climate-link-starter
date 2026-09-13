#!/usr/bin/env bash
set -euo pipefail

expected_branch='work/device-rule-decoupling-20260913'
expected_head='9e3507529a432ccf84633835a041e407652bae86'
plan='docs/implementation/device-rule-decoupling-plan.md'

actual_branch="$(git branch --show-current)"
if [[ "$actual_branch" != "$expected_branch" ]]; then
  echo "Unexpected branch: $actual_branch" >&2
  exit 1
fi

actual_head="$(git rev-parse HEAD)"
if [[ "$actual_head" != "$expected_head" ]]; then
  echo "Unexpected HEAD: $actual_head" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo 'Working tree is not clean.' >&2
  git status --short >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

path = Path('docs/implementation/device-rule-decoupling-plan.md')
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, got {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)

replace_once(
"""For climate rules:\n\n```text\nsaved plug + saved thermometer + climate rule config\n    -> generated Shelly script deployment\n```\n\nFor time rules:\n\n```text\nsaved plug + schedule config\n    -> native Shelly schedule deployment\n```\n\nThe phone remains only the configurator/management UI. Runtime automation stays on Shelly.\n""",
"""For climate rules:\n\n```text\nsaved plug + saved thermometer + climate rule config + optional time constraint\n    -> one generated Shelly script deployment\n```\n\nFor time rules:\n\n```text\nsaved plug + schedule config\n    -> native Shelly schedule deployment\n```\n\nA time constraint on a climate rule is part of that same climate rule and must execute inside its climate script. Never deploy a climate script and a separate native schedule that compete for the same relay. A standalone `TimeRule` remains the correct representation when time is the primary automation and no climate sensor condition is involved.\n\nThe phone remains only the configurator/management UI. Runtime automation stays on Shelly.\n\n### Target-form invariants\n\nThese are product/domain invariants, not temporary implementation details:\n\n- plugs, thermometers and rules are independent durable entities;\n- thermometers are global devices and never belong to a plug; `SavedSensor` must not contain `plugId`;\n- the durable relationship between a thermometer and a plug exists only through a rule;\n- rule names are independent from device names; renaming a plug or thermometer must not rename a rule, and renaming a rule must not mutate device identity or names;\n- runtime observation provenance such as “last seen via phone” or “last seen via plug X” is transient runtime state, not durable device ownership;\n- exactly one rule may own a `(plugId, relayId)` in the current product model;\n- time is both a standalone rule type and an optional constraint on climate rules;\n- desired rule configuration is independent from deployment state, so a rule may remain configured while its runtime is missing, drifted or awaiting repair.\n"""
)

replace_once(
"""For the current MVP, identity can be derived deterministically from normalized profile + Shelly-side runtime address. Do not use an unstable iOS scan identifier as physical identity.\n\nKeep live readings separate from the durable device model.\n""",
"""For the current MVP, identity can be derived deterministically from normalized profile + Shelly-side runtime address. Do not use an unstable iOS scan identifier as physical identity.\n\nA saved thermometer is global. It must not persist `plugId`, owner plug, discovery plug or any equivalent parent relationship. The same BLE thermometer may be visible to multiple Shellys, and deleting a plug must never cascade-delete thermometers. Rule selectors derive durable usage as `sensor -> rule -> plug`.\n\nKeep live readings and observation provenance separate from the durable device model. If the app can prove a current/recent reading source, runtime state may expose data such as `observer = phone | plugId`, `lastSeenAtMs`, RSSI and latest values. This may power UI such as “last seen via”, but it must not be persisted as sensor ownership and must be omitted when provenance is unknown.\n"""
)

old_rule_shape = """Suggested shape:\n\n```ts\ntype ClimateRule = {\n  version: 1;\n  id: string;\n  kind: 'climate';\n  plugId: string;\n  relayId: number;\n  sensorId: string;\n  config: ClimateRuleConfig;\n  deployment: null | {\n    scriptId: number;\n    scriptHash: string;\n    safetyVerifiedAtMs: number | null;\n  };\n  createdAtMs: number;\n  updatedAtMs: number;\n};\n\ntype TimeRule = {\n  version: 1;\n  id: string;\n  kind: 'time';\n  plugId: string;\n  relayId: number;\n  config: DailyTimeAutomationConfig;\n  deployment: null | {\n    onJobId: number;\n    offJobId: number;\n  };\n  createdAtMs: number;\n  updatedAtMs: number;\n};\n```\n\nDo not duplicate the full plug snapshot in every rule. Resolve `plugId` through the plug store. Resolve `sensorId` through the sensor store.\n\nA missing referenced device is an integrity error, not a valid steady state.\n\nThe exact climate config representation may keep using the existing typed script-generator config, but avoid storing duplicated identity fields if they can drift independently from the referenced device. Build the generator input from the current rule + resolved plug/sensor at deployment time.\n"""
new_rule_shape = """Suggested target shape:\n\n```ts\ntype Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;\n\ntype RuleTimeWindow = {\n  days: Weekday[];\n  start: string; // local HH:mm\n  end: string;   // local HH:mm; may cross midnight\n};\n\ntype RuleSchedule = {\n  windows: RuleTimeWindow[];\n};\n\ntype ClimateRule = {\n  version: 1;\n  id: string;\n  kind: 'climate';\n  name: string;\n  plugId: string;\n  relayId: number;\n  sensorId: string;\n  config: ClimateRuleConfig;\n  schedule: RuleSchedule | null;\n  deployment: null | {\n    scriptId: number;\n    scriptHash: string;\n    safetyVerifiedAtMs: number | null;\n  };\n  createdAtMs: number;\n  updatedAtMs: number;\n};\n\ntype TimeRule = {\n  version: 1;\n  id: string;\n  kind: 'time';\n  name: string;\n  plugId: string;\n  relayId: number;\n  config: {\n    schedule: RuleSchedule;\n  };\n  deployment: null | {\n    onJobId: number;\n    offJobId: number;\n  };\n  createdAtMs: number;\n  updatedAtMs: number;\n};\n```\n\nThe current UI may initially expose only one every-day time window, but persistence and rule semantics must not require a future storage migration merely to add weekday-specific or multiple windows. Normalize/validate windows in one rule-domain helper, including cross-midnight semantics.\n\nFor a climate rule, `schedule: null` means climate control is unrestricted by time. When a schedule is present, its windows are OR conditions: the climate algorithm may control the relay only inside an active window. Outside all active windows the required state is OFF. If local time cannot be trusted while a climate time constraint is enabled, fail closed to OFF and surface runtime attention rather than guessing.\n\nFor a standalone time rule, the schedule is the primary automation and should continue to compile/deploy to native Shelly schedule resources when supported. Do not create those native schedule jobs for a climate rule's time constraint.\n\nDo not duplicate the full plug snapshot in every rule. Resolve `plugId` through the plug store. Resolve `sensorId` through the sensor store.\n\nA missing referenced device is an integrity error, not a valid steady state.\n\nRule `name` is user-owned display metadata and is deliberately independent from plug/sensor names. Device renames must not rewrite rule names or force deployment identity changes.\n\nThe exact climate config representation may keep using the existing typed script-generator config, but avoid storing duplicated identity fields if they can drift independently from the referenced device. Build the generator input from the current rule + resolved plug/sensor at deployment time.\n"""
replace_once(old_rule_shape, new_rule_shape)

replace_once(
"""Semantics:\n\n- a real saved owner blocks another rule on that relay;\n- an orphan Local Climate Link script blocks deployment but has an explicit remediation path in Plug management;\n- an unmanaged Shelly schedule remains protected and blocks conflicting automation;\n- deployment metadata whose remote resource is verified missing must not permanently reserve the relay; mark the rule as attention/not deployed and allow recovery or deletion;\n- never auto-delete a conflict as a side effect of creating another rule.\n""",
"""Semantics:\n\n- a real saved owner blocks another rule on that relay;\n- an orphan Local Climate Link script blocks deployment but has an explicit remediation path in Plug management;\n- an unmanaged Shelly schedule remains protected and blocks conflicting automation;\n- a climate rule with a time constraint remains one owner and one climate deployment; its time constraint must not create a competing native schedule;\n- a standalone `TimeRule` and a `ClimateRule` therefore cannot coexist on the same `(plugId, relayId)` under the current one-owner model;\n- deployment metadata whose remote resource is verified missing must not permanently reserve the relay; mark the rule as attention/not deployed and allow recovery or deletion;\n- never auto-delete a conflict as a side effect of creating another rule.\n"""
)

replace_once(
"""### Climate\n\n1. choose rule intent/preset (temperature/humidity modes as current UI supports);\n2. choose a saved plug;\n3. choose a saved thermometer;\n4. configure thresholds/advanced settings using the current Rule UI;\n5. validate pure config;\n6. resolve ownership/live conflicts;\n7. deploy exact climate runtime;\n8. run mandatory safe relay test;\n9. mark deployment safety verified and complete setup.\n""",
"""### Climate\n\n1. choose rule intent/preset (temperature/humidity modes as current UI supports);\n2. give the rule its own user-visible name;\n3. choose a saved plug;\n4. choose a saved thermometer;\n5. configure thresholds/advanced settings using the current Rule UI;\n6. optionally configure an active time window/schedule constraint;\n7. validate pure config;\n8. resolve ownership/live conflicts;\n9. deploy one exact climate runtime containing both climate logic and any time constraint;\n10. run mandatory safe relay test;\n11. mark deployment safety verified and complete setup.\n"""
)

replace_once(
"""### Time\n\n1. choose a saved plug;\n2. configure native schedule;\n3. validate clock/capabilities/conflicts;\n4. create and verify the two schedule jobs transactionally;\n5. persist deployment metadata.\n\nNo thermometer is involved.\n""",
"""### Time\n\n1. give the rule its own user-visible name;\n2. choose a saved plug;\n3. configure the rule schedule;\n4. validate clock/capabilities/conflicts;\n5. create and verify the native schedule resources transactionally;\n6. persist deployment metadata.\n\nNo thermometer is involved. A time rule is still shown in the same Rules section as climate rules; “time” is a rule type, not a separate product area.\n"""
)

replace_once(
"""Desired configuration and runtime deployment are different states.\n\nAt minimum, climate rules need to represent:\n""",
"""Desired configuration and runtime deployment are different states. The supported lifecycle is `create -> deploy -> verify -> edit -> redeploy -> pause/resume -> recover -> delete`; editing desired configuration must not require deleting/recreating the durable rule identity. Redeploy must preserve OFF-first/exact-ownership safety and either verify the new runtime or leave an actionable recoverable state.\n\nAt minimum, climate rules need to represent:\n"""
)

replace_once(
"""- sensor identity normalization;\n- plug deletion blocked by referencing rule;\n- sensor deletion blocked by referencing climate rule;\n- climate/time output ownership matrix;\n""",
"""- sensor identity normalization;\n- saved sensor has no plug ownership field and remains after unrelated plug deletion;\n- derived sensor usage resolves through climate rule -> current plug;\n- rule names remain unchanged when referenced plug/sensor names change;\n- plug deletion blocked by referencing rule;\n- sensor deletion blocked by referencing climate rule;\n- climate/time output ownership matrix;\n- schedule normalization including weekday and cross-midnight windows;\n"""
)

replace_once(
"""- climate safe test failure leaves rule recoverable but not healthy/complete;\n- time schedule partial failure still rolls back and forces safe state.\n""",
"""- climate safe test failure leaves rule recoverable but not healthy/complete;\n- climate time constraint executes inside the climate script and does not create native schedule jobs;\n- climate time constraint outside its active window forces OFF;\n- climate time constraint with unavailable/untrusted local time fails closed OFF;\n- time schedule partial failure still rolls back and forces safe state.\n"""
)

replace_once(
"""- references block physical-device deletion with useful copy;\n- climate rule device selectors use existing registries;\n- time rule selector uses plug registry only;\n""",
"""- references block physical-device deletion with useful copy;\n- Thermometers UI can show durable “used by” rule/plug relationships derived from rules without persisting plug ownership;\n- any “last seen via” source is shown only from proven runtime provenance and is not fabricated;\n- climate rule device selectors use existing registries;\n- climate rule setup supports an optional time constraint without creating a second rule/owner;\n- time rule selector uses plug registry only;\n- rule names are editable/displayed independently from device names;\n"""
)

replace_once(
"""6. create climate rule by selecting saved plug + sensor; verify install + safe relay test + runtime status;\n7. switch climate rule MANUAL, run temporary Shelly BLE discovery, close it, verify mode remains MANUAL and relay OFF;\n8. remove climate rule; verify managed script removed but both plug and thermometer remain saved;\n9. re-add/rescan the same Shelly at another reachable endpoint if practical; verify identity deduplicates by device id.\n""",
"""6. create climate rule by selecting saved plug + sensor; verify install + safe relay test + runtime status;\n7. add a climate active-time constraint; verify no native schedule jobs are created for it, verify outside-window behavior is OFF, and verify rule ownership remains singular;\n8. switch climate rule MANUAL, run temporary Shelly BLE discovery, close it, verify mode remains MANUAL and relay OFF;\n9. rename the plug and thermometer; verify the climate rule keeps its independent name and still resolves current devices correctly;\n10. remove climate rule; verify managed script removed but both plug and thermometer remain saved;\n11. remove an unreferenced plug; verify globally saved thermometers remain intact;\n12. re-add/rescan the same Shelly at another reachable endpoint if practical; verify identity deduplicates by device id.\n"""
)

replace_once(
"""- [ ] saved devices do not depend on an automation existing;\n- [ ] rule records reference device ids and do not duplicate mutable device snapshots;\n- [ ] deleting a local device does not silently orphan a rule;\n""",
"""- [ ] saved devices do not depend on an automation existing;\n- [ ] saved thermometers are global and never persist plug ownership;\n- [ ] observation provenance is runtime state, not durable sensor ownership;\n- [ ] rule records reference device ids and do not duplicate mutable device snapshots;\n- [ ] rule names are independent from device names and survive device renames unchanged;\n- [ ] deleting a local device does not silently orphan a rule;\n"""
)

replace_once(
"""- [ ] time schedule transaction rollback semantics remain intact;\n- [ ] unmanaged native schedules remain protected conflicts;\n""",
"""- [ ] climate time constraints execute in the owned climate script and never as competing native schedule jobs;\n- [ ] climate schedule constraints fail closed OFF when time is unavailable/untrusted;\n- [ ] time schedule transaction rollback semantics remain intact;\n- [ ] unmanaged native schedules remain protected conflicts;\n"""
)

replace_once(
"""4. rules must reference saved devices and own only desired config + deployment metadata;\n5. preserve existing polished Plug/Thermometer UX;\n6. preserve or strengthen OFF-first/exact-ownership safety;\n7. fix the MANUAL/AUTO inconsistency and BLE discovery mode restoration;\n8. keep architecture gates and full verification green.\n""",
"""4. rules must reference saved devices and own only desired config + deployment metadata;\n5. thermometers must remain global devices, with usage derived from rules rather than persisted plug ownership;\n6. rule names must remain independent from device names;\n7. time must work both as a standalone rule and as an optional climate constraint without creating competing relay owners;\n8. preserve existing polished Plug/Thermometer UX;\n9. preserve or strengthen OFF-first/exact-ownership safety;\n10. fix the MANUAL/AUTO inconsistency and BLE discovery mode restoration;\n11. keep architecture gates and full verification green.\n"""
)

path.write_text(text)
PY

git diff --check
git diff -- "$plan"

git add "$plan"
git commit -m 'Update device-rule target model invariants'

echo "FINAL_HEAD=$(git rev-parse HEAD)"
git status --short
