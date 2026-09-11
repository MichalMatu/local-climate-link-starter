from pathlib import Path

p = Path('/tmp/run-navigation-ux-consistency-v10-inner.sh')
s = p.read_text()
marker = "pnpm exec prettier --write \\\n  apps/mobile/src/routes/AppRoutes.tsx"
if s.count(marker) != 1:
    raise SystemExit(f'prettier marker mismatch: {s.count(marker)}')
insertion = (
    "python3 /tmp/navigation-ux-v9-extra.py\n"
    "pnpm exec prettier --write apps/mobile/e2e/responsive.spec.ts apps/mobile/src/app/appShell.css apps/mobile/src/__tests__/app-routes.test.tsx\n\n"
)
s = s.replace(marker, insertion + marker, 1)
p.write_text(s)
