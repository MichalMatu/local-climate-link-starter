# Local Climate Link landing

Static marketing and beta landing page for GitHub Pages.

## Commands

```bash
pnpm dev:landing
pnpm check:landing
pnpm build:landing
pnpm --filter @lcl/landing lint
pnpm --filter @lcl/landing test
```

The Vite base path is derived from `GITHUB_REPOSITORY` in GitHub Actions. For a
custom domain or preview path, set `LANDING_BASE_PATH`.

`pnpm check:landing` is the deployment gate for the marketing site. It runs
Prettier check, ESLint, the shared UX quality gate, TypeScript, Vitest, and the
production build. The GitHub Pages workflow must use this gate before uploading
`apps/landing/dist`.

## Localization and theme

The landing page resolves the browser/system language automatically and supports
the same locales as the app: `pl`, `en`, `de`, `es`, `fr`, `it`, and `pt-BR`.
Unsupported languages fall back to English.

The page follows the system light/dark preference through CSS
`prefers-color-scheme`. There is no visible theme or language switcher on the
sales page.

Landing-specific CSS may define local color tokens in `src/styles/tokens.css`.
Reusable layout CSS must consume tokens and use breakpoint values registered in
`packages/design-tokens/tokens/tokens.json`.

## Asset policy

The hero image is generated specifically for this project and contains no vendor
logos. Vendor product pages and GitHub projects are linked as compatibility
references instead of copying catalog photos without a commercial-use license.
