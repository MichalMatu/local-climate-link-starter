# ADR-0006 — Independent devices and automation rules

## Status

Accepted (user-authorized implementation plan, 2026-09-13).

## Context

Device identity and lifetime currently depend on setup drafts and installed
runtime snapshots. This duplicates endpoints, prevents independent plug management,
and leaves orphan climate scripts without a recovery path.

## Decision

Implement the approved device/rule decoupling plan in reviewable phases. Dedicated
plug and sensor registries persist physical devices. Rules persist device references,
desired settings and exact runtime deployment metadata. Shelly identity is its
normalized device id; its endpoint is mutable. Sensor identity is its profile plus
normalized Shelly runtime address. Readings are not durable device fields.

Climate safety verification is separate from script upload. The relay conflict
resolver requires verified live inventory before declaring deployed resources
missing. It enumerates orphan script ids and protects native schedules. Device
removal rejects references; deployed rule removal requires runtime cleanup first.

Repositories are the only storage boundary. New keys are `lcl.plugs.v1`,
`lcl.sensors.v1`, and `lcl.rules.v1`; no legacy reads, migrations, or dual writes.
Store factories inject current reference readers, avoiding store import cycles.
Storage failure cannot be reported as successful persistence.

## Consequences

Devices can outlive rules and endpoints resolve from the current plug record.
Runtime operations must verify physical identity again before mutation. Unknown
inventory and persistence errors need explicit error/recovery UI. Existing product
callers are switched in the subsequent implementation phases; the old product
models are removed when that switch is complete.

No framework, production dependency, runtime safety contract or visual design is
changed by this decision. The phone remains a configurator.

## Alternatives considered

- Keep devices in the setup draft: retains the wrong lifetime and ownership boundary.
- Copy endpoints into rules: permits stale address drift after DHCP changes.
- Migrate old development storage: explicitly excluded by repository policy.
- Delete conflicting scripts during install: cannot safely infer user intent or ownership.
