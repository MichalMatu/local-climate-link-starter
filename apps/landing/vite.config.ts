import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBase =
  process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/';

export default defineConfig({
  base: process.env.LANDING_BASE_PATH ?? githubPagesBase,
  plugins: [react()],
  server: {
    port: 5174
  }
});
