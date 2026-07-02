import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const version = process.argv[2];

if (!version) {
  throw new Error('Usage: node scripts/release/collect-android-release.mjs <version>');
}

const releaseDir = join('artifacts', 'releases', `v${version}`);
const artifacts = [
  {
    source: join(
      'apps',
      'mobile',
      'android',
      'app',
      'build',
      'outputs',
      'apk',
      'release',
      'app-release.apk'
    ),
    target: `local-climate-link-v${version}-android-release.apk`
  },
  {
    source: join(
      'apps',
      'mobile',
      'android',
      'app',
      'build',
      'outputs',
      'bundle',
      'release',
      'app-release.aab'
    ),
    target: `local-climate-link-v${version}-android-release.aab`
  }
];

mkdirSync(releaseDir, { recursive: true });

const checksumLines = artifacts.map(({ source, target }) => {
  const targetPath = join(releaseDir, target);
  copyFileSync(source, targetPath);
  const digest = createHash('sha256').update(readFileSync(targetPath)).digest('hex');

  return `${digest}  ${basename(targetPath)}`;
});

writeFileSync(
  join(releaseDir, `local-climate-link-v${version}-sha256.txt`),
  `${checksumLines.join('\n')}\n`
);

console.log(`Collected Android release artifacts in ${releaseDir}`);
