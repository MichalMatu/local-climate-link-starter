# @lcl/design-tokens

Purpose: source design tokens for Local Climate Link UI packages and the mobile app.

Public API:

- `tokens` from `@lcl/design-tokens`
- CSS variables from `@lcl/design-tokens/styles.css`

Examples:

```ts
import { tokens } from '@lcl/design-tokens';
import '@lcl/design-tokens/styles.css';
```

Tests: this package has no runtime tests yet. `pnpm --filter @lcl/design-tokens build` validates the token build path.

Do not import React, Ionic, BLE, Shelly, or app flow code here.

Note: this first skeleton uses a small deterministic build script instead of Style Dictionary. Replacing it with Style Dictionary should preserve the same token names and CSS variable output.
