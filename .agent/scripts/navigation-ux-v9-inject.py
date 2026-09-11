from pathlib import Path

p = Path('/tmp/run-navigation-ux-consistency-v9-inner.sh')
s = p.read_text()
marker = "pnpm exec prettier --write \\\n  apps/mobile/src/routes/AppRoutes.tsx"
if s.count(marker) != 1:
    raise SystemExit(f'prettier marker mismatch: {s.count(marker)}')
s = s.replace(marker, "python3 /tmp/navigation-ux-v9-extra.py\n" + marker, 1)
p.write_text(s)
