import { access, readFile, readdir } from 'node:fs/promises';
import { posix as path } from 'node:path';

const repoRoot = new URL('../../', import.meta.url);
const failures = [];

const readRepoFile = async (repoPath) => readFile(new URL(repoPath, repoRoot), 'utf8');
const readJson = async (repoPath) => JSON.parse(await readRepoFile(repoPath));
const addFailure = (repoPath, message) => failures.push(`${repoPath}: ${message}`);
const lineCount = (source) => source.split('\n').length;
const isTypeScriptSource = (repoPath) => /\.(?:ts|tsx)$/.test(repoPath);
const isTestSource = (repoPath) =>
  /(?:^|\/)__tests__\//.test(repoPath) || /\.(?:test|spec)\.(?:ts|tsx)$/.test(repoPath);

const repoPathExists = async (repoPath) => {
  try {
    await access(new URL(repoPath, repoRoot));
    return true;
  } catch {
    return false;
  }
};

const listRepoFiles = async (directory) => {
  if (!(await repoPathExists(directory))) return [];

  const entries = await readdir(new URL(`${directory}/`, repoRoot), {
    withFileTypes: true
  });
  const nested = await Promise.all(
    entries.map((entry) => {
      const repoPath = `${directory}/${entry.name}`;
      return entry.isDirectory() ? listRepoFiles(repoPath) : [repoPath];
    })
  );
  return nested.flat();
};

const moduleSpecifiers = (source) => {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
};

const stripSourceExtension = (repoPath) => repoPath.replace(/\.(?:ts|tsx|js|jsx)$/, '');
const featurePrefix = 'apps/mobile/src/features/';

const featureNameFromPath = (repoPath) => {
  if (!repoPath.startsWith(featurePrefix)) return null;
  const relative = repoPath.slice(featurePrefix.length);
  const [featureName] = relative.split('/');
  return featureName || null;
};

const resolveRelativeSpecifier = (sourcePath, specifier) => {
  if (!specifier.startsWith('.')) return null;
  return stripSourceExtension(
    path.normalize(path.join(path.dirname(sourcePath), specifier))
  );
};

const checkFeatureAgentContract = async () => {
  const contractPath = 'apps/mobile/src/features/AGENTS.md';
  if (!(await repoPathExists(contractPath))) {
    addFailure(contractPath, 'feature-level agent contract is required');
    return;
  }

  const source = await readRepoFile(contractPath);
  if (lineCount(source) > 180) {
    addFailure(
      contractPath,
      'feature agent contract must stay focused and under 180 lines'
    );
  }
  for (const marker of ['Public API', 'Feature isolation', 'Side-effect ownership']) {
    if (!source.includes(marker)) {
      addFailure(contractPath, `feature agent contract lost required marker: ${marker}`);
    }
  }
};

const checkMobileRootShape = async () => {
  const allowedDirectories = new Set([
    '__tests__',
    'app',
    'components',
    'features',
    'flows',
    'mocks',
    'permissions',
    'routes',
    'screens',
    'test',
    'theme'
  ]);
  const entries = await readdir(new URL('apps/mobile/src/', repoRoot), {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (entry.isDirectory() && !allowedDirectories.has(entry.name)) {
      addFailure(
        `apps/mobile/src/${entry.name}`,
        'new mobile root directories require an explicit architecture decision; product capabilities belong under features/<feature>'
      );
    }
  }
};

const legacyTopLevelModules = new Map([
  [
    'apps/mobile/src/screens',
    new Set([
      'AutomationDashboardScreen.tsx',
      'InstallationDetailScreen.tsx',
      'InstallationDiagnosticsScreen.tsx',
      'InstallationScriptScreen.tsx',
      'PlugBleDiscoveryScreen.tsx',
      'PlugSettingsScreen.tsx',
      'SetupIntentScreen.tsx',
      'ShellyLedSettingsCard.tsx',
      'TimeAutomationCard.tsx',
      'TimeInstallationDetail.tsx'
    ])
  ],
  ['apps/mobile/src/flows', new Set(['setup-intent.ts'])],
  [
    'apps/mobile/src/components',
    new Set([
      'AppBottomNavigation.tsx',
      'AppPageBack.tsx',
      'AppShell.tsx',
      'AppToastViewport.tsx',
      'EditablePlugName.tsx',
      'RefreshIconButton.tsx'
    ])
  ]
]);

const checkLegacyTopLevelFreeze = async () => {
  for (const [directory, allowedFiles] of legacyTopLevelModules) {
    const entries = await readdir(new URL(`${directory}/`, repoRoot), {
      withFileTypes: true
    });
    for (const entry of entries) {
      if (
        !entry.isFile() ||
        !isTypeScriptSource(entry.name) ||
        isTestSource(entry.name)
      ) {
        continue;
      }
      if (!allowedFiles.has(entry.name)) {
        addFailure(
          `${directory}/${entry.name}`,
          'new top-level product modules are closed in legacy screens/flows/components; put the cohesive capability under features/<feature> or explicitly revise the architecture boundary'
        );
      }
    }
  }
};

const packageNameFromSpecifier = (specifier) => {
  const parts = specifier.split('/');
  if (parts.length < 2 || !parts[0].startsWith('@')) return null;
  return `${parts[0]}/${parts[1]}`;
};

const checkWorkspacePackagePublicImports = async () => {
  const packageManifestPaths = (await listRepoFiles('packages')).filter(
    (repoPath) => repoPath.endsWith('/package.json') && repoPath.split('/').length === 3
  );
  const packageManifests = new Map();

  for (const manifestPath of packageManifestPaths) {
    const manifest = await readJson(manifestPath);
    packageManifests.set(manifest.name, { manifest, manifestPath });
  }

  const sourceFiles = [
    ...(await listRepoFiles('apps/mobile/src')),
    ...(await listRepoFiles('packages'))
  ].filter(isTypeScriptSource);

  for (const sourcePath of sourceFiles) {
    const source = await readRepoFile(sourcePath);
    for (const specifier of moduleSpecifiers(source)) {
      if (!specifier.startsWith('@lcl/')) continue;

      const packageName = packageNameFromSpecifier(specifier);
      const packageInfo = packageManifests.get(packageName);
      if (!packageInfo) continue;

      const subpath = specifier.slice(packageName.length).replace(/^\//, '');
      const exportKey = subpath ? `./${subpath}` : '.';
      const exportsField = packageInfo.manifest.exports;
      const isExported =
        exportKey === '.'
          ? typeof exportsField === 'string' || Boolean(exportsField?.['.'])
          : Boolean(exportsField?.[exportKey]);

      if (!isExported) {
        addFailure(
          sourcePath,
          `deep import bypasses ${packageName} public API: ${specifier}; export the capability intentionally or import from the package public surface`
        );
      }
    }
  }
};

const reservedFeatureNames = new Set([
  'base',
  'common',
  'core',
  'helpers',
  'misc',
  'shared',
  'utils'
]);
const genericFeatureModuleNames = new Set([
  'common',
  'helpers',
  'manager',
  'misc',
  'service',
  'utils'
]);

const checkFeatureShape = async () => {
  const entries = await readdir(new URL('apps/mobile/src/features/', repoRoot), {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const featureName = entry.name;
    const featureRoot = `${featurePrefix}${featureName}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(featureName)) {
      addFailure(featureRoot, 'feature directory names must use descriptive kebab-case');
    }
    if (reservedFeatureNames.has(featureName)) {
      addFailure(
        featureRoot,
        'catch-all feature names are forbidden; name the concrete product capability'
      );
    }

    const publicApiPath = `${featureRoot}/index.ts`;
    if (!(await repoPathExists(publicApiPath))) {
      addFailure(
        publicApiPath,
        'every feature must expose one explicit public API index.ts'
      );
    } else {
      const publicApi = await readRepoFile(publicApiPath);
      if (lineCount(publicApi) > 120) {
        addFailure(
          publicApiPath,
          'feature public API exceeds 120 lines; keep the surface narrow'
        );
      }
      if (/\bexport\s+(?:type\s+)?\*\s+from\b/.test(publicApi)) {
        addFailure(
          publicApiPath,
          'wildcard exports are forbidden in feature public APIs; export intentional names only'
        );
      }
    }

    const featureFiles = (await listRepoFiles(featureRoot)).filter(
      (repoPath) => isTypeScriptSource(repoPath) && !isTestSource(repoPath)
    );
    for (const sourcePath of featureFiles) {
      const baseName = path.basename(stripSourceExtension(sourcePath)).toLowerCase();
      if (genericFeatureModuleNames.has(baseName)) {
        addFailure(
          sourcePath,
          'generic feature module names hide responsibility; use a concrete domain/task name'
        );
      }
    }
  }
};

const featureRootForName = (featureName) => `${featurePrefix}${featureName}`;
const isFeaturePublicTarget = (resolvedTarget, featureName) => {
  const featureRoot = featureRootForName(featureName);
  return resolvedTarget === featureRoot || resolvedTarget === `${featureRoot}/index`;
};

const allowedFeatureDependencies = new Map();

const checkFeatureImportBoundaries = async () => {
  const mobileFiles = (await listRepoFiles('apps/mobile/src')).filter(isTypeScriptSource);

  for (const sourcePath of mobileFiles) {
    const sourceFeature = featureNameFromPath(sourcePath);
    const source = await readRepoFile(sourcePath);

    for (const specifier of moduleSpecifiers(source)) {
      const resolvedTarget = resolveRelativeSpecifier(sourcePath, specifier);
      if (!resolvedTarget) continue;

      const targetFeature = featureNameFromPath(resolvedTarget);
      if (targetFeature && targetFeature !== sourceFeature) {
        if (!isFeaturePublicTarget(resolvedTarget, targetFeature)) {
          addFailure(
            sourcePath,
            `private cross-feature import is forbidden: ${specifier}; import only through features/${targetFeature}/index.ts`
          );
          continue;
        }

        if (sourceFeature) {
          const allowed = allowedFeatureDependencies.get(sourceFeature) ?? new Set();
          if (!allowed.has(targetFeature)) {
            addFailure(
              sourcePath,
              `feature ${sourceFeature} must not depend on feature ${targetFeature} by default; compose them in app/routes, extract shared domain code to a package, or explicitly review the feature dependency`
            );
          }
        }
      }

      if (
        sourceFeature &&
        (resolvedTarget.startsWith('apps/mobile/src/screens/') ||
          resolvedTarget.startsWith('apps/mobile/src/routes/') ||
          resolvedTarget.startsWith('apps/mobile/src/flows/'))
      ) {
        addFailure(
          sourcePath,
          `feature ${sourceFeature} must not depend back on legacy screen/route/flow layers: ${specifier}`
        );
      }
    }
  }
};

const checkPresentationSideEffectBoundaries = async () => {
  const mobileFiles = (await listRepoFiles('apps/mobile/src')).filter(
    (repoPath) => isTypeScriptSource(repoPath) && !isTestSource(repoPath)
  );
  const presentationFiles = mobileFiles.filter(
    (repoPath) =>
      repoPath.startsWith('apps/mobile/src/screens/') ||
      repoPath.startsWith('apps/mobile/src/components/') ||
      (repoPath.startsWith(featurePrefix) &&
        (repoPath.includes('/screens/') || repoPath.includes('/components/')))
  );

  for (const sourcePath of presentationFiles) {
    const source = await readRepoFile(sourcePath);
    if (/\bfetch\s*\(/.test(source)) {
      addFailure(
        sourcePath,
        'presentation must not call fetch directly; use a feature flow/data boundary'
      );
    }
    if (source.includes('@capacitor-community/bluetooth-le')) {
      addFailure(sourcePath, 'presentation must not import the Capacitor BLE transport');
    }
    if (
      /\b(?:localStorage|sessionStorage)\b/.test(source) ||
      source.includes('@capacitor/preferences')
    ) {
      addFailure(
        sourcePath,
        'presentation must not own durable storage; use a feature state/repository boundary'
      );
    }
  }
};

const checkSharedStylesheetBudgets = async () => {
  const budgets = new Map([
    ['apps/mobile/src/theme/theme.css', 3334],
    ['packages/ui/src/styles.css', 750]
  ]);

  for (const [repoPath, maxLines] of budgets) {
    const lines = lineCount(await readRepoFile(repoPath));
    if (lines > maxLines) {
      addFailure(
        repoPath,
        `shared stylesheet exceeds ${maxLines} lines (${lines}); keep feature styles feature-local and split reusable primitive styles instead of growing a global dumping ground`
      );
    }
  }
};

await checkFeatureAgentContract();
await checkMobileRootShape();
await checkLegacyTopLevelFreeze();
await checkWorkspacePackagePublicImports();
await checkFeatureShape();
await checkFeatureImportBoundaries();
await checkPresentationSideEffectBoundaries();
await checkSharedStylesheetBudgets();

if (failures.length > 0) {
  console.error('Feature boundary quality gate failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Feature boundary quality gate passed.');
}
