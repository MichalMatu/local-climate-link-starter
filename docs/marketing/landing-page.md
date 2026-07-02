# Landing page plan

The first public page is a static Vite/React site in `apps/landing`, deployed
through GitHub Pages.

## Positioning

Primary promise:

```text
Termostat bez huba.
Termometr BLE + gniazdko Shelly.
Konfigurujesz raz w aplikacji, działa lokalnie.
```

The page sells the narrow MVP path instead of generic smart-home automation:

- Shelly Plug S Gen3 as the local runtime controller,
- Xiaomi LYWSD03MMC / PVVX / BTHome v2 as the first sensor path,
- TP357 custom BLE as the second sensor path,
- no cloud, no Home Assistant, no MQTT requirement, no phone background loop.

## Design decisions

- React + Vite: matches the existing stack and builds to static files for
  GitHub Pages.
- Tokenized CSS: the page imports project design tokens and adds a small
  landing-specific token layer for color, radius, spacing, shadows, and hero
  media.
- Automatic localization: the landing page resolves the browser language and
  supports the same locales as the mobile app: Polish, English, German, Spanish,
  French, Italian, and Portuguese Brazil.
- Automatic theme: the page follows `prefers-color-scheme` with no visible
  switcher, so the marketing surface stays visually quiet.
- Generated hero image: avoids unlicensed vendor catalog photos while still
  showing the real product relationship: thermometer, smart plug, phone, and
  local climate load.
- Official compatibility references are external links, not copied product
  imagery.

## Sources checked

- Vite static deploy guidance: https://vite.dev/guide/static-deploy.html
- GitHub Pages Actions deployment: https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Web performance image guidance: https://web.dev/learn/performance/image-performance
- Shelly Plug S Gen3 product reference: https://www.shelly.com/products/shelly-plug-s-gen3-1
- PVVX Xiaomi thermometer firmware reference:
  https://github.com/pvvx/ATC_MiThermometer

## GitHub Pages setup

1. In the repository settings, open **Pages**.
2. Set **Build and deployment** source to **GitHub Actions**.
3. Run the **GitHub Pages** workflow manually or push changes under
   `apps/landing`.

## Quality gate

Use the landing-specific gate before publishing:

```bash
pnpm check:landing
```

The gate runs:

- Prettier format check,
- ESLint,
- the shared UX quality gate,
- TypeScript typecheck,
- Vitest landing tests,
- production Vite build.

The shared UX gate checks landing CSS for tokenized colors, border widths,
z-index values, and registered breakpoint values. Landing color definitions stay
centralized in `apps/landing/src/styles/tokens.css`; reusable page styles must
consume those variables instead of hardcoding colors.
