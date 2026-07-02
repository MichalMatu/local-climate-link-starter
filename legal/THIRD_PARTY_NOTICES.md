# Third-party notices

This file must be updated whenever third-party code, examples, parser definitions, or generated assets are copied, vendored, or substantially derived.

## Current policy

Project-owned code is licensed under the custom source-available
noncommercial license in `LICENSE`. Commercial use requires prior written
permission from Michal Matuszewski or a separate commercial license.

Do not copy code from these projects without license review:

```text
Shelly script examples
PVVX / ATC_MiThermometer
Theengs Decoder
Tasmota
mitemp_bt2
random GitHub parser snippets
```

Reference links are allowed in documentation. Runtime dependency or copied code requires explicit license review.

## Parser reference warning

Theengs Decoder is a useful compatibility database, but it is GPL-3.0. The
Local Climate Link source-available noncommercial license is not GPL-compatible,
so do not copy or vendor Theengs GPL code into runtime code. Treat Theengs as a
reference and validation source only unless the project is relicensed or the GPL
obligations are handled through a separate written decision.

## Shelly script examples

Shelly script examples are used as reference material only:

```text
Source: https://github.com/ALLTERCO/shelly-script-examples
License: Apache-2.0
Copyright: 2024 Shelly Europe
```

The full upstream example tree is not vendored in this repository. If a pattern
is promoted into product code, copy only the needed project-owned implementation
and keep tests and attribution.

## Runtime and development dependencies in the first skeleton

The first implementation uses dependencies from the approved stack:

```text
React / React DOM — MIT
Ionic React — MIT
Capacitor Core / CLI — MIT
@capacitor-community/bluetooth-le — MIT
TanStack Query — MIT
Zustand — MIT
Zod — MIT
Vite / @vitejs/plugin-react — MIT
TypeScript — Apache-2.0
Vitest — MIT
React Testing Library / jest-dom — MIT
ESLint / typescript-eslint — MIT
Prettier — MIT
jsdom — MIT
Husky — MIT
lint-staged — MIT
Playwright / @playwright/test — Apache-2.0
```

The TP357 parser model is derived from the project owner's MatrixHub repository (`MichalMatu/MatrixHub`), which was explicitly approved for reuse in this repository. No Theengs GPL decoder code is vendored or copied into runtime code.
