# Local Climate Link Sandbox-First Execution Flow

Status: **ACTIVE**

## Goal

Use the ChatGPT sandbox as the default software-only build/test worker, GitHub Actions as the canonical networked verifier, and Local Agent only when a task genuinely needs the user's Mac, Android signing setup, Shelly/ESP32 hardware, BLE, USB, or other machine-local resources.

The repository stays the source of truth. ChatGPT Library stores only reproducible source snapshots and dependency caches.

## Worker roles

### ChatGPT sandbox — default software worker

Use for:

- source inspection and patch preparation;
- TypeScript checks;
- ESLint and Prettier;
- Vitest/unit/component tests;
- design-token and UX quality gates;
- Vite/mobile web builds;
- landing-page builds;
- Playwright responsive smoke when the sandbox has the required Linux browser libraries.

Target sandbox baseline:

- Linux x86_64;
- Node.js 22;
- pnpm 10.12.4;
- no assumption of direct package-network access.

### GitHub Actions — canonical networked worker

Use for:

- dependency downloads;
- exact source snapshots;
- reusable offline pnpm/Playwright packs;
- normal CI on the exact pushed SHA.

### Local Agent — machine/hardware worker

Use Local Agent for:

- real Shelly RPC and relay tests;
- BLE scans and real sensors;
- ESP32/local-network diagnostics;
- Android native/release builds that need the local Android SDK or upload signing key;
- USB, serial, local files, or services not reproducible in the sandbox.

Routine TypeScript/React changes should prefer sandbox + CI.

## Persistent ChatGPT Library layout

Use:

`/LocalClimateLink/Sandbox/`

Source snapshots:

- `lcl-source-<git-sha>.tar.zst`
- `lcl-source-<git-sha>.tar.zst.sha256`

Offline dependency packs are stored by dependency key, for example:

- `lcl-offline-<dependency-key>/manifest/full-pack.name`
- `lcl-offline-<dependency-key>/manifest/full-pack.sha256`
- `lcl-offline-<dependency-key>/manifest/parts.sha256`
- `lcl-offline-<dependency-key>/part-00` ... `part-N`

Never store keystores, signing passwords, `.env` files, tokens, private diagnostics, local device data, or credentials in these packs.

## Offline pack contents

The pack contains only reusable development dependencies:

- a pinned pnpm 10.12.4 runtime;
- a pnpm store populated from `pnpm-lock.yaml`;
- Playwright Chromium binaries;
- metadata containing dependency input hashes and the dependency key.

It intentionally does not contain `node_modules`. A fresh sandbox recreates workspace links and `node_modules` with `pnpm install --offline --frozen-lockfile`.

## Dependency key

The key changes when dependency-relevant inputs change, including:

- root `package.json`;
- `pnpm-lock.yaml`;
- `pnpm-workspace.yaml`;
- workspace `package.json` files under `apps/` and `packages/`;
- sandbox bootstrap/doctor/run scripts;
- Node major version;
- pnpm version;
- Playwright browser target.

Source-only application changes do not invalidate the offline dependency pack.

The exact source snapshot also embeds its dependency key. Bootstrap and doctor reject a snapshot when that key differs from the restored offline pack.

## Fresh sandbox bootstrap

1. Read `AGENTS.md`, `README.md`, and this document.
2. Determine the exact target Git SHA.
3. Restore the matching `lcl-source-<sha>.tar.zst` from Library or the matching GitHub Actions artifact.
4. Verify its SHA-256 and extract it, for example:

   ```bash
   mkdir -p /mnt/data/local-climate-link-source
   tar --zstd -xf lcl-source-<sha>.tar.zst -C /mnt/data/local-climate-link-source
   ```

5. Confirm `.sandbox-snapshot/git-sha.txt` equals the intended SHA.
6. Restore the offline dependency pack matching `.sandbox-snapshot/dependency-key.txt`.
7. If split, verify `parts.sha256`, concatenate parts in order, verify `full-pack.sha256`, and extract it.
8. From the extracted repository root run:

   ```bash
   tools/sandbox/bootstrap-sandbox.sh \
     /mnt/data/local-climate-link-sandbox \
     /mnt/data/local-climate-link-offline

   source /mnt/data/local-climate-link-sandbox/env.sh
   tools/sandbox/sandbox-doctor.sh
   ```

9. Run the narrowest useful check first, then broaden.

Never silently test a source snapshot whose embedded SHA or dependency key does not match the requested revision/environment.

## Running checks

Profiles:

```bash
tools/sandbox/run-sandbox-check.sh test
tools/sandbox/run-sandbox-check.sh core
tools/sandbox/run-sandbox-check.sh build
tools/sandbox/run-sandbox-check.sh mobile
tools/sandbox/run-sandbox-check.sh landing
tools/sandbox/run-sandbox-check.sh check
tools/sandbox/run-sandbox-check.sh full
```

Meaning:

- `test` — all workspace Vitest suites;
- `core` — coverage gate for automation-core and script-generator;
- `build` — all workspace builds;
- `mobile` — lint, typecheck, test, and Vite build for the mobile package;
- `landing` — landing-page deploy gate;
- `check` — repository `pnpm check`;
- `full` — `pnpm check:full`, including Playwright responsive smoke.

For one affected test, use pnpm directly after sourcing `env.sh`.

## Verification ladder

Prefer the cheapest useful evidence first:

1. changed-file/static inspection;
2. one affected Vitest/package check;
3. `mobile`, `landing`, `core`, or `build` profile as appropriate;
4. `check`;
5. `full` when browser/system libraries allow it;
6. exact-SHA GitHub Actions result;
7. Local Agent only for hardware/native/local-machine evidence.

A sandbox pass supplements but does not replace canonical CI for changes intended for `main`.

## GitHub Actions pack generation

`.github/workflows/sandbox-pack.yml` always creates an exact source snapshot on matching pushes.

The larger offline dependency pack is generated only when explicitly requested:

- workflow dispatch with `include_offline_dependencies=true`; or
- a pushed commit whose message contains `[sandbox-offline]`.

During offline-pack generation, Actions performs an offline install from the newly generated store and runs the sandbox doctor plus `check` against an exact archived source copy before publishing the pack.

The archive is split into transport-sized parts for ChatGPT Library.

When dependency inputs change, create a new dependency-key folder instead of modifying an older pack.

## Android and hardware boundary

The sandbox validates the shared TypeScript/web application code. It is not the authority for a signed Android release or real device behavior.

Keep these on Local Agent / the real machine:

- `pnpm release:android` with the registered Play upload key;
- real Capacitor/BLE behavior;
- Shelly installation/relay/soak tests;
- ESP32 and local-network hardware diagnostics.

## Source-of-truth policy

- GitHub branch/commit is canonical source.
- Library source snapshots are transport/cache artifacts only.
- Library dependency packs are reproducible build caches only.
- Local Agent output is machine evidence, not source code.
- Never commit `node_modules`, Playwright browser caches, Library bundles, keystores, or secrets.
