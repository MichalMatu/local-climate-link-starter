# @lcl/device-profiles

Purpose: typed sensor and output compatibility metadata.

Public API:

- `sensorProfiles`
- `outputProfiles`
- profile ID schemas and Zod validators

Examples:

```ts
import { sensorProfiles, shellyPlugSGen3Profile } from '@lcl/device-profiles';
```

Tests validate that committed profiles conform to the Zod schemas.

Do not import React, Ionic, app screens, Shelly RPC clients, or script generation code here.
