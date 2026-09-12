# Deep architecture and cleanliness audit

Branch baseline: `ac1d2c900467be4330a09567f286a6c364072c9a`  
Package version: `2.0.10`

## Verification

- PASS `quality:repo` (exit 0)
- PASS `lint` (exit 0)
- PASS `typecheck` (exit 0)
- PASS `test` (exit 0)
- PASS `coverage:core` (exit 0)
- PASS `build` (exit 0)
- PASS `format:check` (exit 0)
- FAIL `e2e:responsive` (exit 1)

## Repository scale

- Files: 485
- Code files: 216
- Documentation files: 59

## God-object / oversized module candidates

- `apps/mobile/src/__tests__/hardware-setup.test.tsx` — 3190 lines, 14 imports, 0 hooks
- `apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts` — 1022 lines, 19 imports, 30 hooks (useState=9, useMemo=11, useRef=1, useMutation=9)
- `scripts/hardware/shelly-soak-logger.ts` — 1286 lines, 2 imports, 0 hooks
- `apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx` — 877 lines, 10 imports, 12 hooks (useState=2, useEffect=9, useCallback=1)
- `apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx` — 765 lines, 12 imports, 13 hooks (useState=3, useEffect=6, useRef=4)
- `packages/shelly-client/src/__tests__/shelly-client.test.ts` — 1047 lines, 1 imports, 0 hooks
- `apps/mobile/e2e/responsive.spec.ts` — 995 lines, 1 imports, 0 hooks
- `apps/landing/src/content.ts` — 991 lines, 0 imports, 0 hooks
- `apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx` — 702 lines, 10 imports, 9 hooks (useState=3, useEffect=5, useRef=1)
- `packages/script-generator/src/__tests__/generator.test.ts` — 892 lines, 1 imports, 0 hooks
- `apps/mobile/src/screens/InstallationDetailScreen.tsx` — 513 lines, 21 imports, 9 hooks (useState=4, useCallback=2, useRef=1, useMutation=1, useQuery=1)
- `scripts/hardware/shelly-real-matrix.ts` — 716 lines, 3 imports, 0 hooks
- `apps/mobile/src/flows/hardware-setup/shellyRequests.ts` — 706 lines, 4 imports, 0 hooks
- `apps/mobile/src/app/locales/fr.ts` — 690 lines, 1 imports, 0 hooks
- `apps/mobile/src/app/locales/pl.ts` — 692 lines, 0 imports, 0 hooks
- `apps/mobile/src/app/locales/de.ts` — 685 lines, 1 imports, 0 hooks
- `apps/mobile/src/app/locales/it.ts` — 684 lines, 1 imports, 0 hooks
- `apps/mobile/src/app/locales/es.ts` — 682 lines, 1 imports, 0 hooks
- `apps/mobile/src/app/locales/ptBr.ts` — 679 lines, 1 imports, 0 hooks
- `apps/mobile/src/app/locales/en.ts` — 678 lines, 1 imports, 0 hooks
- `apps/mobile/src/__tests__/automation-detail.test.tsx` — 608 lines, 10 imports, 0 hooks
- `packages/shelly-client/src/scripts/install.ts` — 630 lines, 3 imports, 0 hooks
- `scripts/quality/ux-gate.mjs` — 612 lines, 1 imports, 0 hooks
- `apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx` — 491 lines, 6 imports, 3 hooks (useState=1, useEffect=2)
- `packages/script-generator/src/shelly/generate.ts` — 565 lines, 3 imports, 0 hooks
- `apps/mobile/android/app/src/main/assets/public/assets/lcl-domain-BBD_8-qC.js` — 469 lines, 3 imports, 0 hooks

## Long functions / components

- `apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts:160` `useHardwareSetupFlow` — 860 lines, 0 params
- `apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx:45` `ShellySetupPage` — 720 lines, 1 params
- `apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx:169` `RuleSetupPage` — 708 lines, 1 params
- `apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx:180` `SensorSetupPage` — 522 lines, 1 params
- `packages/script-generator/src/shelly/generate.ts:133` `generateShellyBleDiscoveryScript` — 432 lines, 0 params
- `apps/mobile/android/app/src/main/assets/public/assets/lcl-domain-BBD_8-qC.js:42` `Rr` — 427 lines, 0 params
- `apps/mobile/src/screens/InstallationDetailScreen.tsx:149` `InstalledAutomationDetail` — 364 lines, 1 params
- `apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx:180` `DiagnosticsSetupPage` — 311 lines, 1 params
- `apps/mobile/src/screens/TimeInstallationDetail.tsx:51` `TimeInstallationDetail` — 300 lines, 1 params
- `apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts:57` `useShellyControlFlow` — 234 lines, 0 params
- `apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx:49` `TimeScheduleSetupPage` — 220 lines, 1 params
- `scripts/hardware/shelly-soak-logger.ts:1069` `main` — 215 lines, 0 params
- `apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts:54` `usePhoneSensorFlow` — 211 lines, 1 params
- `apps/mobile/src/screens/AutomationDashboardScreen.tsx:51` `ClimateAutomationCard` — 204 lines, 1 params
- `apps/mobile/src/screens/InstallationDiagnosticsModal.tsx:71` `InstallationDiagnosticsModal` — 198 lines, 1 params
- `apps/mobile/src/app/AppSettingsScreen.tsx:67` `AppSettingsScreen` — 193 lines, 1 params
- `apps/mobile/src/app/DevCommandPalette.tsx:49` `DevCommandPalette` — 189 lines, 0 params
- `apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx:264` `SavedShellyDeviceCard` — 169 lines, 1 params
- `apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx:89` `HardwareSetupScreen` — 160 lines, 1 params
- `packages/shelly-client/src/scripts/install.ts:304` `installScript` — 156 lines, 1 params
- `apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts:28` `useShellyBleDiscoveryFlow` — 150 lines, 0 params
- `packages/ui/src/primitives/Modal.tsx:37` `Modal` — 149 lines, 1 params
- `scripts/hardware/shelly-real-matrix.ts:565` `run` — 149 lines, 0 params
- `apps/mobile/e2e/responsive.spec.ts:57` `mockShellyRpc` — 137 lines, 1 params
- `apps/mobile/src/routes/AppRoutes.tsx:80` `AppRoutes` — 137 lines, 0 params
- `apps/mobile/e2e/led-settings.spec.ts:114` `mockShelly` — 135 lines, 3 params
- `apps/mobile/src/__tests__/automation-detail.test.tsx:88` `installShellyFetchMock` — 131 lines, 1 params
- `apps/mobile/e2e/responsive.spec.ts:195` `mockTimeShellyRpc` — 130 lines, 1 params
- `apps/mobile/e2e/responsive.spec.ts:62` `handleRpc` — 128 lines, 1 params
- `packages/shelly-client/src/__tests__/shelly-client.test.ts:89` `call` — 126 lines, 1 params
- `apps/mobile/e2e/led-settings.spec.ts:122` `handleRpc` — 123 lines, 1 params
- `packages/ble-core/src/parsers/bthome.ts:72` `parseBthomeV2Payload` — 123 lines, 2 params
- `apps/mobile/e2e/responsive.spec.ts:207` `handleRpc` — 113 lines, 1 params
- `apps/mobile/src/flows/time-automation/runtime.ts:308` `updateDailyTimeAutomation` — 110 lines, 1 params
- `apps/mobile/src/screens/ShellyLedSettingsCard.tsx:26` `ShellyLedSettingsCard` — 107 lines, 1 params
- `packages/ble-core/src/adapters/capacitor.ts:163` `startScan` — 104 lines, 1 params
- `scripts/hardware/shelly-soak-logger.ts:506` `maybeCycleRelayThresholds` — 103 lines, 1 params
- `apps/mobile/src/__tests__/automation-detail.test.tsx:231` `installTimeShellyFetchMock` — 100 lines, 0 params
- `scripts/hardware/shelly-soak-logger.ts:868` `updateSummary` — 93 lines, 5 params
- `apps/mobile/src/screens/AutomationDashboardScreen.tsx:270` `AutomationDashboardScreen` — 91 lines, 1 params

## Highest fan-in

- `apps/mobile/android/app/src/main/assets/public/assets/vendor-react-kdQ1lfBM.js` — 6 importers
- `apps/mobile/android/app/src/main/assets/public/assets/preload-helper-BXl3LOEh.js` — 5 importers
- `apps/landing/src/content.ts` — 3 importers
- `apps/mobile/android/app/src/main/assets/public/assets/_commonjsHelpers-CqkleIqs.js` — 3 importers
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-capacitor-Dz-8_eBV.js` — 3 importers
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-misc-mtA2gi9w.js` — 3 importers
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-state-o7WQzVcG.js` — 3 importers
- `apps/landing/src/page.tsx` — 2 importers
- `apps/mobile/android/app/src/main/assets/public/assets/lcl-domain-BBD_8-qC.js` — 2 importers
- `apps/mobile/android/app/src/main/assets/public/assets/lcl-ui-DVNCtlBa.js` — 2 importers
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-query-S9-YqtEK.js` — 2 importers
- `apps/landing/src/sections.tsx` — 1 importers
- `apps/mobile/android/app/src/main/assets/public/assets/index-Bm_La6dY.js` — 1 importers
- `.lcl-architecture-audit-analyze.mjs` — 0 importers
- `apps/landing/src/main.tsx` — 0 importers
- `apps/landing/src/page.test.tsx` — 0 importers
- `apps/landing/src/test/setup.ts` — 0 importers
- `apps/landing/src/vite-env.d.ts` — 0 importers
- `apps/landing/vite.config.ts` — 0 importers
- `apps/landing/vitest.config.ts` — 0 importers

## Highest fan-out

- `apps/mobile/android/app/src/main/assets/public/assets/HardwareSetupScreen-BFdqS2IJ.js` — 10 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/index-Bm_La6dY.js` — 9 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/lcl-domain-BBD_8-qC.js` — 3 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-misc-mtA2gi9w.js` — 3 local dependencies
- `apps/landing/src/page.test.tsx` — 2 local dependencies
- `apps/landing/src/page.tsx` — 2 local dependencies
- `apps/landing/src/main.tsx` — 1 local dependencies
- `apps/landing/src/sections.tsx` — 1 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/lcl-ui-DVNCtlBa.js` — 1 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-capacitor-Dz-8_eBV.js` — 1 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-query-S9-YqtEK.js` — 1 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-react-kdQ1lfBM.js` — 1 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/vendor-state-o7WQzVcG.js` — 1 local dependencies
- `.lcl-architecture-audit-analyze.mjs` — 0 local dependencies
- `apps/landing/src/content.ts` — 0 local dependencies
- `apps/landing/src/test/setup.ts` — 0 local dependencies
- `apps/landing/src/vite-env.d.ts` — 0 local dependencies
- `apps/landing/vite.config.ts` — 0 local dependencies
- `apps/landing/vitest.config.ts` — 0 local dependencies
- `apps/mobile/android/app/src/main/assets/public/assets/_commonjsHelpers-CqkleIqs.js` — 0 local dependencies

## Import cycles

- none detected in relative source imports

## Documentation integrity

- Broken relative links: 0
- References to versions different from current `2.0.10`: 85
  - `README.md` references `2.0.8`
  - `apps/mobile/test-results/responsive-hardware-setup--42657-tal-overflow-on-phone-small/error-context.md` references `192.168.0`
  - `apps/mobile/test-results/responsive-hardware-setup--42657-tal-overflow-on-phone-small/error-context.md` references `1.7.5`
  - `apps/mobile/test-results/responsive-hardware-setup--9e8b5-tal-overflow-on-phone-large/error-context.md` references `192.168.0`
  - `apps/mobile/test-results/responsive-hardware-setup--9e8b5-tal-overflow-on-phone-large/error-context.md` references `1.7.5`
  - `apps/mobile/test-results/responsive-hardware-setup--aef79-izontal-overflow-on-desktop/error-context.md` references `192.168.0`
  - `apps/mobile/test-results/responsive-hardware-setup--aef79-izontal-overflow-on-desktop/error-context.md` references `1.7.5`
  - `apps/mobile/test-results/responsive-hardware-setup--c0511-rizontal-overflow-on-tablet/error-context.md` references `192.168.0`
  - `apps/mobile/test-results/responsive-hardware-setup--c0511-rizontal-overflow-on-tablet/error-context.md` references `1.7.5`
  - `apps/mobile/test-results/responsive-hardware-setup--c9c01-orizontal-overflow-on-phone/error-context.md` references `192.168.0`
  - `apps/mobile/test-results/responsive-hardware-setup--c9c01-orizontal-overflow-on-phone/error-context.md` references `1.7.5`
  - `docs/SANDBOX_EXECUTION_FLOW.md` references `10.12.4`
  - `docs/parser-sources.md` references `1.2.3`
  - `docs/parser-sources.md` references `1.7.5`
  - `docs/plan.md` references `1.0.0`
  - `docs/product/next-functional-steps.md` references `2.0.9`
  - `docs/product/next-functional-steps.md` references `1.7.5`
  - `docs/product/next-functional-steps.md` references `192.168.0`
  - `docs/prompts/continue-e2e-freeze.md` references `2.0.9`
  - `docs/prompts/continue-e2e-freeze.md` references `2.0.0`
  - `docs/prompts/continue-e2e-freeze.md` references `192.168.0`
  - `docs/prompts/local-climate-link-next-audit.md` references `2.0.7`
  - `docs/release/android-phone-alpha.md` references `2.0.8`
  - `docs/release/pre-commercial-hardening.md` references `2.0.5`
  - `docs/release/pre-commercial-hardening.md` references `2.0.9`
  - `docs/release/pre-commercial-hardening.md` references `8.9.1`
  - `docs/release/pre-commercial-hardening.md` references `8.11.1`
  - `docs/release/pre-commercial-hardening.md` references `1.7.5`
  - `docs/testing/hardware-matrix.md` references `1.7.5`
  - `docs/testing/hardware-matrix.md` references `192.168.0`
  - `docs/testing/hardware-matrix.md` references `1.2.3`
  - `docs/testing/hardware-matrix.md` references `2.0.5`
  - `packages/script-generator/README.md` references `1.2.3`

### Largest docs

- `AGENTS.md` — 1102 lines
- `docs/testing/hardware-matrix.md` — 387 lines
- `docs/product/next-functional-steps.md` — 374 lines
- `docs/development/repository-guide.md` — 331 lines
- `docs/parser-sources.md` — 305 lines
- `docs/implementation/vertical-slices.md` — 300 lines
- `apps/mobile/test-results/responsive-hardware-setup--42657-tal-overflow-on-phone-small/error-context.md` — 288 lines
- `apps/mobile/test-results/responsive-hardware-setup--9e8b5-tal-overflow-on-phone-large/error-context.md` — 288 lines
- `apps/mobile/test-results/responsive-hardware-setup--aef79-izontal-overflow-on-desktop/error-context.md` — 288 lines
- `apps/mobile/test-results/responsive-hardware-setup--c0511-rizontal-overflow-on-tablet/error-context.md` — 288 lines
- `apps/mobile/test-results/responsive-hardware-setup--c9c01-orizontal-overflow-on-phone/error-context.md` — 288 lines
- `apps/mobile/test-results/responsive-daily-time-auto-12e34-stalls-and-renders-on-phone/error-context.md` — 259 lines
- `apps/mobile/test-results/responsive-daily-time-auto-75212--and-renders-on-phone-small/error-context.md` — 259 lines
- `apps/mobile/test-results/responsive-daily-time-auto-78208-alls-and-renders-on-desktop/error-context.md` — 259 lines
- `apps/mobile/test-results/responsive-daily-time-auto-92254-talls-and-renders-on-tablet/error-context.md` — 259 lines
- `apps/mobile/test-results/responsive-daily-time-auto-beab5-e-edit-and-delete-lifecycle/error-context.md` — 259 lines
- `apps/mobile/test-results/responsive-daily-time-auto-ed1cc--and-renders-on-phone-large/error-context.md` — 259 lines
- `apps/mobile/test-results/responsive-rule-page-switc-82de4-copies-the-generated-script/error-context.md` — 251 lines
- `docs/release/pre-commercial-hardening.md` — 235 lines
- `docs/plan.md` — 225 lines
- `docs/troubleshooting/mvp.md` — 217 lines
- `docs/implementation/adapter-contracts.md` — 212 lines
- `docs/SANDBOX_EXECUTION_FLOW.md` — 205 lines
- `docs/architecture/overview.md` — 205 lines
- `docs/HANDOFF_NEXT_CHAT.md` — 200 lines

## TODO / FIXME / HACK / XXX / WIP markers

- `.lcl-architecture-audit-analyze.mjs:34` src.split(/\r?\n/).forEach((line,i)=>{if(/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) todos.push({file:f,line:i+1,text:line.trim().slice(0,240)});});
- `.lcl-architecture-audit-analyze.mjs:36` for(const f of docs){const src=read(f);src.split(/\r?\n/).forEach((line,i)=>{if(/\b(TODO|FIXME|HACK|XXX|WIP)\b/i.test(line)) todos.push({file:f,line:i+1,text:line.trim().slice(0,240)});});}
- `apps/landing/src/content.ts:913` question: 'O telefone precisa ficar ligado o tempo todo?',
- `apps/mobile/android/app/src/main/assets/public/assets/index-Bm_La6dY.js:2` import{r as f,j as a,c as ma}from"./vendor-react-kdQ1lfBM.js";/* empty css                           */import{D as k,M as we,F as Re,T as Ct,S as pa}from"./lcl-ui-DVNCtlBa.js";import{u as re,a as ye,b as J,Q as ha,c as ya}from"./vendor-quer
- `apps/mobile/src/app/locales/es.ts:86` deleteFailed: 'No se pudo eliminar de forma segura todo el horario.',
- `AGENTS.md:285` - No explicit `any` unless a comment explains why and an issue/TODO is added.
- `docs/HANDOFF_NEXT_CHAT.md:113` Validation is green: formatting, lint, `quality:ux`, `quality:repo`, typecheck, all workspace tests, core coverage, build and responsive Playwright (**25/25**). Final read-only diff audit also passed with no TODO/FIXME/HACK, eslint disables
- `docs/HANDOFF_NEXT_CHAT.md:172` Do not create another TODO/continue file for LED work; update the two canonical files above instead.
- `docs/architecture/refactor-boundaries.md:45` The audit also checks for `TODO/FIXME/HACK`, `@ts-ignore`, broad `eslint-disable`,
