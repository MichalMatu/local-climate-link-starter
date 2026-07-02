import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const version = process.argv[2];

if (!version) {
  throw new Error('Usage: node scripts/release/verify-android-release.mjs <version>');
}

const releaseDir = join('artifacts', 'releases', `v${version}`);
const apkPath = join(releaseDir, `local-climate-link-v${version}-android-release.apk`);
const aabPath = join(releaseDir, `local-climate-link-v${version}-android-release.aab`);
const checksumPath = join(releaseDir, `local-climate-link-v${version}-sha256.txt`);
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

const requireFile = (path) => {
  if (!existsSync(path)) {
    throw new Error(`Missing release artifact: ${path}`);
  }
};

const sh = (script) =>
  execFileSync('sh', ['-lc', script], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();

const findAndroidTool = (name) => {
  const command = [
    `command -v '${name}'`,
    `find "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools -name '${name}' -type f 2>/dev/null | sort | tail -1`
  ].join(' || ');

  try {
    const tool = sh(command);

    return tool.length > 0 ? tool : undefined;
  } catch {
    return undefined;
  }
};

const verifyChecksums = () => {
  const expected = new Map(
    readFileSync(checksumPath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => {
        const [digest, file] = line.split(/\s+/);

        return [file, digest];
      })
  );

  for (const file of [apkPath, aabPath]) {
    const name = basename(file);
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');

    if (expected.get(name) !== digest) {
      throw new Error(`SHA256 mismatch for ${name}`);
    }
  }
};

const verifyZip = (path) => {
  execFileSync('unzip', ['-t', path], { stdio: 'pipe' });
};

const verifyAndroidMetadata = () => {
  if (!existsSync(apkMetadataPath)) {
    throw new Error(`Missing Android release metadata: ${apkMetadataPath}`);
  }

  const metadata = JSON.parse(readFileSync(apkMetadataPath, 'utf8'));
  const element = metadata.elements?.[0];

  if (metadata.applicationId !== 'link.localclimate.app') {
    throw new Error(`Unexpected Android applicationId: ${metadata.applicationId}`);
  }

  if (element?.versionName !== version || element?.versionCode !== 20000) {
    throw new Error(
      `Unexpected Android release version: versionName=${element?.versionName}, versionCode=${element?.versionCode}`
    );
  }
};

requireFile(apkPath);
requireFile(aabPath);
requireFile(checksumPath);
verifyChecksums();
verifyZip(apkPath);
verifyZip(aabPath);

const apksigner = findAndroidTool('apksigner');
const aapt = findAndroidTool('aapt');

if (apksigner) {
  execFileSync(apksigner, ['verify', '--verbose', apkPath], { stdio: 'pipe' });
} else {
  execFileSync('jarsigner', ['-verify', apkPath], { stdio: 'pipe' });
}

execFileSync('jarsigner', ['-verify', aabPath], { stdio: 'pipe' });

if (aapt) {
  const badging = execFileSync(aapt, ['dump', 'badging', apkPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const packageLine = badging.split('\n')[0] ?? '';
  if (!packageLine.includes("name='link.localclimate.app'")) {
    throw new Error(`Unexpected Android package line: ${packageLine}`);
  }

  if (
    !packageLine.includes(`versionName='${version}'`) ||
    !packageLine.includes("versionCode='20000'")
  ) {
    throw new Error(`Unexpected Android release version: ${packageLine}`);
  }
} else {
  verifyAndroidMetadata();
}

console.log(`Verified Android release artifacts in ${releaseDir}`);
