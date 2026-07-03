import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const version = process.argv[2];

if (!version) {
  throw new Error('Usage: node scripts/release/collect-android-release.mjs <version>');
}

const releaseDir = join('artifacts', 'releases', `v${version}`);
const apkMetadataPath = join(
  'apps',
  'mobile',
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'output-metadata.json'
);

const readReleaseApkPath = () => {
  const metadata = JSON.parse(readFileSync(apkMetadataPath, 'utf8'));
  const outputFile = metadata.elements?.[0]?.outputFile;

  if (typeof outputFile !== 'string' || outputFile.length === 0) {
    throw new Error(`Missing release APK output file in ${apkMetadataPath}`);
  }

  return join(dirname(apkMetadataPath), outputFile);
};

const artifacts = [
  {
    source: readReleaseApkPath(),
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
