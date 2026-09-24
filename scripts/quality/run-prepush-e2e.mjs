import { spawnSync } from 'node:child_process';

const command = process.platform === 'darwin' ? 'e2e:visual' : 'e2e:responsive';
console.log(`Pre-push E2E mode: ${command} (${process.platform})`);
const result = spawnSync('pnpm', [command], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
