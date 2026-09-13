#!/usr/bin/env bash
set -euo pipefail

REPO=/Users/michal/agent-workspace/repos/local-climate-link-starter/work
cd "$REPO"
git fetch origin agent-control work/device-rule-decoupling-20260913
git show origin/agent-control:.agent/scripts/20260913-rule-runtime-foundation-v3.sh > /tmp/lcl-rule-runtime-foundation-v5-base.sh
python3 - <<'PY'
from pathlib import Path
p = Path('/tmp/lcl-rule-runtime-foundation-v5-base.sh')
s = p.read_text()
repls = {
"list: async () => ({ ok: true, value: { jobs: this.jobs } }),": "list: async () => ({ ok: true, value: { jobs: this.jobs, rev: 0 } }),",
"const job = { id: this.nextId++, ...config } as ShellyScheduleJob;": "const job: ShellyScheduleJob = {\n            id: this.nextId++,\n            enable: config.enable ?? true,\n            timespec: config.timespec,\n            calls: config.calls\n          };",
"return { ok: true, value: { id: job.id } };": "return { ok: true, value: { id: job.id, rev: 0 } };",
"this.jobs = this.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job));\n          return { ok: true, value: null };": "this.jobs = this.jobs.map((job) =>\n            job.id === id\n              ? {\n                  ...job,\n                  ...(patch.enable === undefined ? {} : { enable: patch.enable }),\n                  ...(patch.timespec === undefined ? {} : { timespec: patch.timespec }),\n                  ...(patch.calls === undefined ? {} : { calls: patch.calls })\n                }\n              : job\n          );\n          return { ok: true, value: { rev: 0 } };",
"return { ok: true, value: null };\n        }\n      }\n    };\n  }\n}\n\nconst ownership": "return { ok: true, value: { rev: 0 } };\n        }\n      }\n    };\n  }\n}\n\nconst ownership"
}
for old, new in repls.items():
    if old not in s:
        raise SystemExit(f'fixture replacement anchor missing: {old[:80]}')
    s = s.replace(old, new, 1)
p.write_text(s)
PY
bash /tmp/lcl-rule-runtime-foundation-v5-base.sh
