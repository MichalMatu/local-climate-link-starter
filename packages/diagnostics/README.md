# @lcl/diagnostics

Purpose: bounded setup logs, redaction helpers, and support summary export.

Public API:

- `InMemoryDiagnosticLogger`
- `redactValue`
- `exportSupportSummary`

Examples:

```ts
import { InMemoryDiagnosticLogger, exportSupportSummary } from '@lcl/diagnostics';
```

Tests cover secret, token, auth header, IP, and MAC redaction.

Do not import UI screens, BLE adapters, or Shelly runtime code here.
