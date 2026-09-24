import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const repoRoot = resolve(new URL('../../', import.meta.url).pathname);
const ignoredDirectories = new Set([
  '.git',
  '.agent',
  'node_modules',
  'dist',
  'build',
  '.gradle',
  '.idea',
  '.vscode'
]);
const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.yml',
  '.yaml',
  '.html',
  '.xml',
  '.gradle'
]);

const obsoleteProductName = ['Local', 'Climate', 'Link'].join(' ');
const obsoleteIdentifier = ['LOCAL', 'CLIMATE', 'LINK'].join('_');
const obsoleteHelperPrefix = ['isLocal', 'Climate', 'Link'].join('');

const files = [];
const walk = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (textExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
};

await walk(repoRoot);

const failures = [];
for (const path of files) {
  const source = await readFile(path, 'utf8');
  const checks = [
    [obsoleteProductName, 'obsolete product name'],
    [obsoleteIdentifier, 'obsolete pre-rebrand identifier'],
    [obsoleteHelperPrefix, 'obsolete pre-rebrand helper identifier']
  ];
  for (const [needle, label] of checks) {
    if (source.toLowerCase().includes(needle.toLowerCase())) {
      failures.push(`${relative(repoRoot, path)}: ${label}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Shelly Link branding gate failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Shelly Link branding gate passed.');
