import { readFile, readdir } from 'node:fs/promises';

const repoRoot = new URL('../../', import.meta.url);
const failures = [];

const readRepoFile = async (path) => readFile(new URL(path, repoRoot), 'utf8');
const readJson = async (path) => JSON.parse(await readRepoFile(path));

const listRepoFiles = async (directory) => {
  const entries = await readdir(new URL(`${directory}/`, repoRoot), {
    withFileTypes: true
  });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? listRepoFiles(path) : [path];
    })
  );
  return nested.flat();
};

const addFailure = (path, message) => failures.push(`${path}: ${message}`);

const parseVersionCode = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Expected MAJOR.MINOR.PATCH version, got ${version}`);
  }
  const [, major, minor, patch] = match.map(Number);
  if (minor > 99 || patch > 99) {
    throw new Error(
      `Android versionCode mapping requires MINOR and PATCH <= 99: ${version}`
    );
  }
  return major * 10000 + minor * 100 + patch;
};

const checkReleaseVersionConsistency = async () => {
  const rootPackage = await readJson('package.json');
  const mobilePackage = await readJson('apps/mobile/package.json');
  const gradle = await readRepoFile('apps/mobile/android/app/build.gradle');
  const expectedVersion = rootPackage.version;
  const expectedCode = parseVersionCode(expectedVersion);

  if (mobilePackage.version !== expectedVersion) {
    addFailure(
      'apps/mobile/package.json',
      `version ${mobilePackage.version} does not match root ${expectedVersion}`
    );
  }
  if (!gradle.includes(`versionName "${expectedVersion}"`)) {
    addFailure(
      'apps/mobile/android/app/build.gradle',
      `versionName must be ${expectedVersion}`
    );
  }
  if (!gradle.includes(`versionCode ${expectedCode}`)) {
    addFailure(
      'apps/mobile/android/app/build.gradle',
      `versionCode must be ${expectedCode}`
    );
  }

  const releaseOverride = '${LCL_RELEASE_VERSION:-}';
  for (const scriptName of ['release:android', 'release:android:verify']) {
    const command = rootPackage.scripts?.[scriptName] ?? '';
    if (!command.includes(releaseOverride)) {
      addFailure(
        'package.json',
        `${scriptName} must pass the optional LCL_RELEASE_VERSION override`
      );
    }
    if (/LCL_RELEASE_VERSION:-\d+\.\d+\.\d+/.test(command)) {
      addFailure(
        'package.json',
        `${scriptName} must not hard-code a fallback release version`
      );
    }
  }
};

const checkWorkspaceDependencyCycles = async () => {
  const packagePaths = [
    'package.json',
    ...(await listRepoFiles('apps')).filter((path) => path.endsWith('/package.json')),
    ...(await listRepoFiles('packages')).filter((path) => path.endsWith('/package.json'))
  ];
  const packages = new Map();

  for (const path of packagePaths) {
    const manifest = await readJson(path);
    packages.set(manifest.name, { path, manifest });
  }

  const graph = new Map();
  for (const [name, { manifest }] of packages) {
    const dependencies = new Set();
    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies'
    ]) {
      for (const dependency of Object.keys(manifest[section] ?? {})) {
        if (dependency !== name && packages.has(dependency)) {
          dependencies.add(dependency);
        }
      }
    }
    graph.set(name, dependencies);
  }

  const visited = new Set();
  const active = new Set();
  const stack = [];

  const visit = (name) => {
    visited.add(name);
    active.add(name);
    stack.push(name);

    for (const dependency of graph.get(name) ?? []) {
      if (!visited.has(dependency)) {
        visit(dependency);
      } else if (active.has(dependency)) {
        const start = stack.indexOf(dependency);
        addFailure(
          packages.get(name)?.path ?? 'package.json',
          `workspace dependency cycle: ${[...stack.slice(start), dependency].join(' -> ')}`
        );
      }
    }

    stack.pop();
    active.delete(name);
  };

  for (const name of graph.keys()) {
    if (!visited.has(name)) visit(name);
  }
};

const importStatements = (source) =>
  source.match(/import[\s\S]*?from\s+['"][^'"]+['"];?|import\s+['"][^'"]+['"];?/g) ?? [];

const checkScreenBoundaries = async () => {
  const screenFiles = (await listRepoFiles('apps/mobile/src/screens')).filter((path) =>
    /\.(?:ts|tsx)$/.test(path)
  );

  for (const path of screenFiles) {
    const source = await readRepoFile(path);
    if (/\bfetch\s*\(/.test(source)) {
      addFailure(path, 'screen must not call fetch directly; use a flow/client boundary');
    }
    if (source.includes('@capacitor-community/bluetooth-le')) {
      addFailure(path, 'screen must not import the Capacitor BLE plugin directly');
    }

    for (const statement of importStatements(source)) {
      if (
        statement.includes("'@lcl/shelly-client'") ||
        statement.includes('"@lcl/shelly-client"')
      ) {
        if (!/^import\s+type\b/.test(statement.trim())) {
          addFailure(path, 'screen may use only type imports from @lcl/shelly-client');
        }
      }
    }
  }
};

const checkDomainPackageBoundaries = async () => {
  const domainPackages = [
    'automation-core',
    'ble-core',
    'device-profiles',
    'diagnostics',
    'script-generator',
    'shelly-client'
  ];

  for (const packageName of domainPackages) {
    const files = (await listRepoFiles(`packages/${packageName}/src`)).filter(
      (path) => /\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\./.test(path)
    );
    for (const path of files) {
      const source = await readRepoFile(path);
      for (const statement of importStatements(source)) {
        if (/from\s+['"](?:react|@ionic\/)/.test(statement)) {
          addFailure(path, 'domain package must not import React or Ionic');
        }
        if (
          statement.includes('@capacitor-community/bluetooth-le') &&
          ![
            'packages/ble-core/src/adapters/capacitor.ts',
            'packages/ble-core/src/adapters/capacitor-gatt.ts'
          ].includes(path)
        ) {
          addFailure(
            path,
            'Capacitor BLE import is allowed only in the ble-core adapter'
          );
        }
      }
    }
  }
};

const checkHardwareSetupArchitecture = async () => {
  const orchestratorPath = 'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts';
  const orchestrator = await readRepoFile(orchestratorPath);
  const orchestratorLines = orchestrator.split('\n').length;
  const orchestratorBudget = 650;
  if (orchestratorLines > orchestratorBudget) {
    addFailure(
      orchestratorPath,
      `hardware setup orchestrator exceeds ${orchestratorBudget} lines (${orchestratorLines}); extract a cohesive subsystem instead of growing the god-flow`
    );
  }

  const returnStart = orchestrator.lastIndexOf('\n  return {');
  const returnEnd = orchestrator.indexOf('\n  };', returnStart);
  if (returnStart === -1 || returnEnd === -1) {
    addFailure(orchestratorPath, 'cannot locate hardware setup public return surface');
  } else {
    const returnBody = orchestrator.slice(returnStart, returnEnd);
    const publicFields = [
      ...returnBody.matchAll(/^ {4}([A-Za-z_$][\w$]*)(?:,|:|$)/gm)
    ].map((match) => match[1]);
    if (publicFields.length > 110) {
      addFailure(
        orchestratorPath,
        `hardware setup public API has ${publicFields.length} fields; keep page contracts narrow and remove internal-only return values`
      );
    }
  }

  for (const forbidden of [
    'new CapacitorBleScanner',
    'generateShellyBleDiscoveryScript()',
    'const setShellyControlState =',
    'setPvvxDeviceTime({'
  ]) {
    if (orchestrator.includes(forbidden)) {
      addFailure(
        orchestratorPath,
        `subsystem implementation leaked back into the orchestrator: ${forbidden}`
      );
    }
  }

  const subsystemBudgets = {
    'apps/mobile/src/flows/hardware-setup/useShellyControlFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useShellyBleDiscoveryFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts': 350
  };
  for (const [path, maxLines] of Object.entries(subsystemBudgets)) {
    const source = await readRepoFile(path);
    const lines = source.split('\n').length;
    if (lines > maxLines) {
      addFailure(
        path,
        `extracted hardware subsystem exceeds ${maxLines} lines (${lines})`
      );
    }
  }

  const compositionBudgets = {
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx': 700,
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx': 650,
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx': 675,
    'apps/mobile/src/screens/hardware-setup/pages/useShellySetupFeedback.ts': 200,
    'apps/mobile/src/screens/hardware-setup/pages/useSensorSetupFeedback.ts': 200,
    'apps/mobile/src/screens/hardware-setup/pages/useRuleSetupFeedback.ts': 180,
    'apps/mobile/src/screens/hardware-setup/pages/RuleAdvancedSettingsModal.tsx': 220,
    'apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useHardwareDiagnosticsFlow.ts': 350,
    'apps/mobile/src/flows/hardware-setup/useClimateAutomationInstallFlow.ts': 350
  };
  for (const [path, maxLines] of Object.entries(compositionBudgets)) {
    const source = await readRepoFile(path);
    const lines = source.split('\n').length;
    if (lines > maxLines) {
      addFailure(
        path,
        `hardware setup responsibility boundary exceeds ${maxLines} lines (${lines}); keep the extracted responsibility cohesive instead of regrowing a god object`
      );
    }
  }

  const pageContracts = {
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx': 'ShellySetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPresentation.tsx':
      'ShellySetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx': 'SensorSetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx': 'RuleSetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx':
      'DiagnosticsSetupFlow',
    'apps/mobile/src/screens/hardware-setup/pages/TimeScheduleSetupPage.tsx':
      'TimeScheduleSetupFlow'
  };
  for (const [path, contract] of Object.entries(pageContracts)) {
    const source = await readRepoFile(path);
    if (!source.includes(contract)) {
      addFailure(path, `hardware setup page must use the narrow ${contract} contract`);
    }
    if (source.includes('HardwareSetupFlow')) {
      addFailure(
        path,
        'hardware setup page must not depend on the full HardwareSetupFlow'
      );
    }
    if (source.includes("HardwarePageProps['flow']")) {
      addFailure(
        path,
        'hardware setup page must not recover the full flow through HardwarePageProps'
      );
    }
  }
};

await checkReleaseVersionConsistency();
await checkWorkspaceDependencyCycles();
await checkScreenBoundaries();
await checkDomainPackageBoundaries();
await checkHardwareSetupArchitecture();

if (failures.length > 0) {
  console.error('Repository quality gate failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Repository quality gate passed.');
}
