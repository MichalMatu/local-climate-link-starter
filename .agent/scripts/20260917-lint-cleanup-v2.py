from pathlib import Path

p = Path('apps/mobile/src/screens/AutomationDashboardScreen.tsx')
s = p.read_text()
s = s.replace("import { useEffect, useState } from 'react';", "import { useCallback, useEffect, useState } from 'react';")
p.write_text(s)
