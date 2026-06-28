import { mkdir, readFile, writeFile } from 'node:fs/promises';
import prettier from 'prettier';

const tokensUrl = new URL('../tokens/tokens.json', import.meta.url);
const distUrl = new URL('../dist/', import.meta.url);
const srcUrl = new URL('../src/', import.meta.url);
const tokens = JSON.parse(await readFile(tokensUrl, 'utf8'));
const { theme, ...baseTokens } = tokens;

const kebab = (value) =>
  value
    .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    .replace(/^2xl$/, '2xl');

const flatten = (node, path = []) =>
  Object.entries(node).flatMap(([key, value]) => {
    const normalizedKey = kebab(key);
    if (
      path.length === 0 &&
      normalizedKey === 'typography' &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      return [
        [['font-family'], String(value.fontFamily)],
        [['font-mono'], String(value.monoFamily)]
      ];
    }

    const nextPath =
      path.length === 0 && normalizedKey === 'status'
        ? ['color', 'status']
        : [...path, normalizedKey];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return flatten(value, nextPath);
    }

    return [[nextPath.join('-'), String(value)]];
  });

const cssVariableLines = (tokenGroup) =>
  flatten(tokenGroup).map(([name, value]) => `  --lcl-${name}: ${value};`);

const cssSource = [
  ':root {',
  '  color-scheme: light;',
  ...cssVariableLines(baseTokens),
  '}',
  '',
  '@media (prefers-color-scheme: dark) {',
  '  :root {',
  '    color-scheme: dark;',
  ...cssVariableLines(theme?.dark ?? {}).map((line) => `  ${line}`),
  '  }',
  '}',
  ''
].join('\n');

const tsSource = `export const tokens = ${JSON.stringify(tokens, null, 2)} as const;\n\nexport type DesignTokens = typeof tokens;\n`;
const prettierConfig = (await prettier.resolveConfig(new URL('../src/index.ts', import.meta.url))) ?? {};
const css = await prettier.format(cssSource, { ...prettierConfig, parser: 'css' });
const ts = await prettier.format(tsSource, { ...prettierConfig, parser: 'typescript' });

await mkdir(distUrl, { recursive: true });
await mkdir(srcUrl, { recursive: true });
await writeFile(new URL('styles.css', distUrl), css);
await writeFile(new URL('tokens.json', distUrl), `${JSON.stringify(tokens, null, 2)}\n`);
await writeFile(new URL('styles.css', srcUrl), css);
await writeFile(new URL('index.ts', srcUrl), ts);
