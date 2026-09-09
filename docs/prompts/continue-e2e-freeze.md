# Continue Local Climate Link physical E2E and freeze

Paste the prompt below into the next ChatGPT window.

```text
Continue the current Local Climate Link work from repository evidence. Do not restart the audit from scratch.

HARD BINDING FOR THIS CONVERSATION:
- LA_AGENT=e75c77cb-7589-4452-94b2-decc97ff85a1
- LA_REPO=local-climate-link-starter
- LA_REPOSITORY=MichalMatu/local-climate-link-starter
- LA_CHAT=chat-a8988eef

Work ONLY on MichalMatu/local-climate-link-starter. Never infer, substitute, inspect, queue, cancel, or execute work for another repository. Every Local Agent task JSON created in this conversation must contain exactly:
  "agent_binding": "e75c77cb-7589-4452-94b2-decc97ff85a1",
  "resources": []
If something seems to require another repo, pause instead of rebinding.

FIRST ACTIONS:
1. Read AGENTS.md.
2. Read docs/HANDOFF_NEXT_CHAT.md completely. Treat it as the canonical execution-state handoff.
3. Check .agent/status/daemon.json on agent-control before editing or queueing work.
4. Verify current main and distinguish the previously tested product SHA 771b23456cf7b3fafe62cba3263e1f8f7118580b from the documentation-only handoff commits added afterward.
5. Continue autonomously from the "Immediate next work" section of docs/HANDOFF_NEXT_CHAT.md.

CURRENT GOAL:
Finish the release freeze after the completed physical Samsung S22+ / Shelly Plug S Gen3 E2E. Do not make new product changes unless a concrete failing test proves a real product bug.

Important established facts:
- Full preflight pnpm check:full already passed on product SHA 771b23456cf7b3fafe62cba3263e1f8f7118580b.
- Frozen v2.0.9 must never move:
  tag object 90378921a79ed3ecb43013e322d27629bf15db64
  commit b44899ba66b202ca05f48a8856a9871daee97832
- Latest observed tags are v2.0.9 down through v2.0.0, then v1.0. The expected next patch candidate is 2.0.10 / Android versionCode 20010, but verify all authoritative version fields before writing.
- Do not use rg unless you first prove it exists; the Local Agent environment reported `rg: command not found`. Use git grep/grep or another available command.
- VPD ranges/configuration stay unchanged. With VPD assist OFF, runtime intentionally reports lastVpd=null and dashboard shows `—`; that is not a bug.
- Real climate automation currently exists on Shelly http://192.168.0.16/, script id 1, name Local Climate Link Thermostat. Last verified state was running=true, relay OFF, no native schedules.
- Physical phone-alpha installs MUST use pnpm android:phone-alpha and MUST intentionally uninstall link.localclimate.app first, clearing app data. Do not ask again.
- The alpha signer expected from the current setup is SHA-256 2909c5fe69d075bde3f18d1f50608880b1c6b8041e08b11d37e9eb4942350b76.
- Device is Samsung SM-S906B / Android 16 / API 36 / ADB serial RFCT70L7E8J.
- Human visual QA was not fully proven; DOM/CDP/native-process evidence must not be called visual PASS.
- Physical stale-sensor failure was intentionally not forced; do not pretend it passed.

Already completed physical E2E includes:
- root/first-level Android Back paths
- real Shelly LAN discovery and add
- real Shelly-side BLE discovery and cleanup/restore
- Xiaomi/PVVX sensor save and live readings
- climate Rule + Send install
- dashboard and Details live state
- Pause automation -> Start automation recovery
- reversible Shelly LED OFF / Show ON-OFF / exact config restore
- time-automation ownership conflict with Schedule.List unchanged
- reversible Offline Shelly UI/recovery through temporary localStorage baseUrl replacement
All of these and their exact caveats are documented in docs/HANDOFF_NEXT_CHAT.md.

NEXT EXECUTION ORDER:
A. Determine all current version locations and release convention.
B. Make the smallest consistent bump to the verified next version; no feature/refactor work.
C. Run pnpm install --frozen-lockfile and pnpm check:full on the exact bump commit.
D. Run pnpm android:phone-alpha on that exact commit. Confirm destructive uninstall, install, versionName/versionCode, signer and PID.
E. Run a short clean-install root smoke. Remember localStorage is intentionally gone after uninstall; do not expect the prior app-side installation record.
F. Independently verify Shelly-side climate script still exists/runs and relay final state is explicit/known. Phone app data deletion must not delete Shelly runtime.
G. Verify GitHub CI for exact freeze SHA.
H. Update docs/testing/hardware-matrix.md with the September 2026 phone E2E evidence.
I. Create a NEW immutable tag/release only after exact-SHA verification. Never retag v2.0.9.

Operating style:
- Polish, concise updates.
- Evidence first.
- Small clean changes, low risk / high gain.
- No unnecessary questions; make best-effort autonomous progress.
- If a Local Agent task is active and healthy, do not poll more often than 2 minutes; use 5+ minutes for full builds/tests.
- Prefer Local Agent for Mac/ADB/build/device work; direct GitHub edits are fine when the exact diff is known and CI can verify it.
- Check active tasks before editing the same branch.
- Do not reset or overwrite /Users/michal/Desktop/local-climate-link-starter.
- Final relay state after hardware mutations must be explicit and known.

Start now by reading docs/HANDOFF_NEXT_CHAT.md and current daemon status, then continue the freeze. Do not ask me to restate prior context.
```
