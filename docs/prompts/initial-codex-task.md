# Initial Codex task prompt

Use this as the first implementation request.

```text
Read AGENTS.md, README.md, plan.md, docs/implementation/vertical-slices.md, docs/implementation/adapter-contracts.md, docs/parser-sources.md, docs/security/230v-safety.md, and docs/architecture/overview.md.

Implement only Slice 0 and Slice 1.

Goal:
Create the Local Climate Link skeleton using Ionic React + Capacitor + TypeScript in a pnpm monorepo. Build a demo-only flow that lets a user add a fake Xiaomi BTHome sensor, add a fake TP357 sensor, add a fake Shelly Plug S Gen3, set heating thresholds, preview a generated Shelly Script, fake-upload it, run a fake relay test, and view diagnostics.

Do not implement real BLE scanning yet.
Do not implement real Shelly hardware calls yet.
Do not add Tasmota/NOUS.
Do not add cloud/MQTT/Home Assistant.
Do not switch stack.
Do not use phone background automation.
Do not introduce Biome. Use ESLint + Prettier as defined in AGENTS.md.

Required packages:
- apps/mobile
- packages/automation-core
- packages/ble-core
- packages/device-profiles
- packages/shelly-client
- packages/script-generator
- packages/design-tokens
- packages/ui
- packages/diagnostics

Required quality gates:
- pnpm format:check
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build

Add tests for the pure automation engine and the initial script generator snapshot.
Update README if commands differ from the plan.
At the end, summarize changed files, checks run, and limitations.
```
