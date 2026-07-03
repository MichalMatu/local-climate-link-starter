import { defineConfig } from '@playwright/test';

const e2ePort = process.env.LCL_E2E_PORT ?? '5173';
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    baseURL: e2eBaseUrl,
    locale: 'pl-PL',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `pnpm --filter @lcl/mobile exec vite --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    url: `${e2eBaseUrl}/admin#shelly`
  }
});
