# @lcl/ui

Purpose: small presentational React components shared by the mobile app.

Public API:

- `StatusBadge`
- `SensorCard`
- `ShellyCard`
- `RuleSummaryCard`
- `DiagnosticRow`
- `Modal`

Examples:

```tsx
import { StatusBadge } from '@lcl/ui';
```

Tests: this first skeleton relies on app-level component tests for rendered flow states.

Do not import BLE scanners, Shelly RPC clients, automation logic, app screens, or package internals here. Use typed props. Components must receive user-facing labels, metric rows, summaries, and button copy from the app/i18n layer.
