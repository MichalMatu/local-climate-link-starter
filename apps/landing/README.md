# Local Climate Link landing

Static marketing and beta landing page for GitHub Pages.

## Commands

```bash
pnpm dev:landing
pnpm build:landing
pnpm --filter @lcl/landing test
```

The Vite base path is derived from `GITHUB_REPOSITORY` in GitHub Actions. For a
custom domain or preview path, set `LANDING_BASE_PATH`.

## Asset policy

The hero image is generated specifically for this project and contains no vendor
logos. Vendor product pages and GitHub projects are linked as compatibility
references instead of copying catalog photos without a commercial-use license.
