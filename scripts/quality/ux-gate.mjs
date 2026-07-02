import { readFile, readdir } from 'node:fs/promises';

const repoRoot = new URL('../../', import.meta.url);
const failures = [];
const cssPaths = ['apps/mobile/src/theme/theme.css', 'packages/ui/src/styles.css'];
const landingTokenizedCssPaths = [
  'apps/landing/src/styles/base.css',
  'apps/landing/src/styles/layout.css',
  'apps/landing/src/styles/components.css',
  'apps/landing/src/styles/responsive.css'
];
const tokenizedCssPaths = [...cssPaths, ...landingTokenizedCssPaths];
const responsiveCssPaths = [...cssPaths, ...landingTokenizedCssPaths];
const hardwareSetupPagePaths = [
  'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx',
  'apps/mobile/src/screens/hardware-setup/pages/DiagnosticsSetupPage.tsx'
];
const feedbackContractPagePaths = [
  ...hardwareSetupPagePaths,
  'apps/mobile/src/screens/DemoWizardScreen.tsx'
];
const packageRuntimeCopyPaths = [
  'packages/ui/src/primitives/DiagnosticRow.tsx',
  'packages/ui/src/primitives/RuleSummaryCard.tsx',
  'packages/ui/src/primitives/ScriptPreview.tsx',
  'packages/ui/src/primitives/SensorCard.tsx',
  'packages/ui/src/primitives/ShellyCard.tsx',
  'packages/ble-core/src/adapters/capacitor.ts',
  'packages/shelly-client/src/rpc/fetch.ts'
];

const readRepoFile = async (path) => readFile(new URL(path, repoRoot), 'utf8');

const listRepoFiles = async (directory) => {
  const entries = await readdir(new URL(`${directory}/`, repoRoot), {
    withFileTypes: true
  });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = `${directory}/${entry.name}`;
      return entry.isDirectory() ? listRepoFiles(entryPath) : [entryPath];
    })
  );

  return files.flat();
};

const addFailure = (path, message) => {
  failures.push(`${path}: ${message}`);
};

const checkSavedShellyCardFeedback = async () => {
  const path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx';
  const source = await readRepoFile(path);
  const start = source.indexOf('const SavedShellyDeviceCard =');
  const end = source.indexOf('export const ShellySetupPage');

  if (start === -1 || end === -1 || end <= start) {
    addFailure(path, 'cannot find the saved Shelly device card boundary');
    return;
  }

  const cardSource = source.slice(start, end);
  const blockedPatterns = [
    ['role="status"', 'transient status text inside a saved device card'],
    ['role="alert"', 'transient alert text inside a saved device card'],
    ['warning-box', 'inline warning box inside a saved device card'],
    ['controlState?.message', 'control message rendered inside a saved device card'],
    ['controlState?.error', 'control error rendered inside a saved device card']
  ];

  blockedPatterns.forEach(([pattern, message]) => {
    if (cardSource.includes(pattern)) {
      addFailure(path, message);
    }
  });
};

const checkTokenizedCss = async () => {
  for (const path of tokenizedCssPaths) {
    const source = await readRepoFile(path);
    if (source.includes('.warning-box') || source.includes('.notice-box')) {
      addFailure(
        path,
        'legacy inline warning/notice box styles must not exist; use ToastViewport, Modal, FeedbackPanel, or field__error'
      );
    }

    source.split('\n').forEach((line, index) => {
      const rawColor = line.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
      if (rawColor) {
        addFailure(path, `line ${index + 1} uses raw color "${rawColor[0]}"`);
      }

      const zIndex = line.match(/\bz-index:\s*([^;]+);/);
      if (zIndex && !zIndex[1].trim().startsWith('var(--lcl-z-index-')) {
        addFailure(path, `line ${index + 1} uses non-tokenized z-index`);
      }

      const rawBorderWidth = line.match(
        /\b(?:border|border-top|border-right|border-bottom|border-left|outline):\s*[12]px\b/
      );
      if (rawBorderWidth) {
        addFailure(
          path,
          `line ${index + 1} uses non-tokenized border/focus width "${rawBorderWidth[0]}"`
        );
      }

      const rawBoxShadowRing = line.match(/\bbox-shadow:\s*0 0 0 [12]px\b/);
      if (rawBoxShadowRing) {
        addFailure(
          path,
          `line ${index + 1} uses non-tokenized focus ring width "${rawBoxShadowRing[0]}"`
        );
      }

      const rawOpacity = line.match(/\bopacity:\s*0\.(?:55|62);/);
      if (rawOpacity) {
        addFailure(path, `line ${index + 1} uses non-tokenized opacity`);
      }
    });
  }
};

const checkFeedbackContractPatterns = async () => {
  for (const path of feedbackContractPagePaths) {
    const source = await readRepoFile(path);
    const blockedClass = source.match(/\b(?:warning-box|notice-box)\b/);
    const inlineLiveRegion = source.match(/role=\{?["'](?:alert|status)["']/);

    if (blockedClass) {
      addFailure(
        path,
        `legacy inline ${blockedClass[0]} found; use field__error, ToastViewport, Modal, or compact diagnostics according to the feedback contract`
      );
    }

    if (inlineLiveRegion) {
      addFailure(
        path,
        'setup flow pages must not render inline role="alert"/role="status"; transient feedback belongs in ToastViewport'
      );
    }

    if (source.includes('pushToast(') && !source.includes('<ToastViewport')) {
      addFailure(path, 'pushToast usage must render the shared ToastViewport');
    }
  }

  const rulePath = 'apps/mobile/src/screens/hardware-setup/pages/RuleSetupPage.tsx';
  const ruleSource = await readRepoFile(rulePath);

  if (
    !ruleSource.includes(
      'open={isInstallBlockModalOpen && flow.installMutation.isError}'
    ) ||
    !ruleSource.includes(
      '<FeedbackPanel tone="danger" title={mutationError(flow.installMutation.error)}>'
    )
  ) {
    addFailure(
      rulePath,
      'installMutation.isError is a blocking install failure and must open a modal with FeedbackPanel, not inline content'
    );
  }

  const installErrorEffectEndMarker =
    '}, [flow.installMutation.error, flow.installMutation.isError]);';
  const installErrorEffectEndIndex = ruleSource.indexOf(installErrorEffectEndMarker);
  const installErrorEffectStartIndex =
    installErrorEffectEndIndex === -1
      ? -1
      : ruleSource.lastIndexOf('useEffect(() => {', installErrorEffectEndIndex);

  if (installErrorEffectStartIndex === -1 || installErrorEffectEndIndex === -1) {
    addFailure(
      rulePath,
      'cannot find installMutation.isError effect for feedback-contract verification'
    );
  } else {
    const installErrorEffectSource = ruleSource.slice(
      installErrorEffectStartIndex,
      installErrorEffectEndIndex + installErrorEffectEndMarker.length
    );
    if (installErrorEffectSource.includes('pushToast(')) {
      addFailure(
        rulePath,
        'blocking install failures must not be duplicated as toast feedback'
      );
    }
  }

  const demoPath = 'apps/mobile/src/screens/DemoWizardScreen.tsx';
  const demoSource = await readRepoFile(demoPath);

  if (
    !demoSource.includes("open={isMatterBlockModalOpen && flow.step === 'shelly'}") ||
    !demoSource.includes(
      '<FeedbackPanel tone="danger" title={t(\'hardware.safety.matterBlocked\')}>'
    )
  ) {
    addFailure(
      demoPath,
      'demo Matter blocked state must use the same blocking modal contract as real hardware setup'
    );
  }
};

const checkUiPackageFeedbackPatterns = async () => {
  const uiSourcePaths = (await listRepoFiles('packages/ui/src')).filter((path) =>
    /\.(?:css|tsx?)$/.test(path)
  );

  for (const path of uiSourcePaths) {
    const source = await readRepoFile(path);
    if (source.includes('warning-box') || source.includes('notice-box')) {
      addFailure(
        path,
        'packages/ui must not expose legacy warning-box/notice-box primitives'
      );
    }

    if (
      path !== 'packages/ui/src/feedback/ToastViewport.tsx' &&
      /role=\{?["'](?:alert|status)["']/.test(source)
    ) {
      addFailure(
        path,
        'packages/ui role="alert"/role="status" feedback must go through ToastViewport'
      );
    }
  }
};

const checkFieldValidationPatterns = async () => {
  for (const path of hardwareSetupPagePaths) {
    const source = await readRepoFile(path);
    const disabledInputStatePattern =
      /disabled=\{\s*!\s*(?:flow\.)?[a-zA-Z0-9_]+InputState\.ok\s*\}/g;
    const warningBoxBeforeInputStateErrorPattern =
      /warning-box[\s\S]{0,500}(?:flow\.)?[a-zA-Z0-9_]+InputState\.error/g;
    const warningBoxAfterInputStateErrorPattern =
      /(?:flow\.)?[a-zA-Z0-9_]+InputState\.error[\s\S]{0,500}warning-box/g;

    if (disabledInputStatePattern.test(source)) {
      addFailure(
        path,
        'form submit must show field-level validation errors instead of being disabled by InputState.ok'
      );
    }

    if (
      warningBoxBeforeInputStateErrorPattern.test(source) ||
      warningBoxAfterInputStateErrorPattern.test(source)
    ) {
      addFailure(
        path,
        'field validation must use field__error with aria-invalid/aria-describedby, not a generic warning-box'
      );
    }
  }
};

const checkTransientFeedbackPatterns = async () => {
  const transientMutationRules = [
    {
      mutation: 'phoneBleScanMutation',
      message:
        'phone BLE scan progress/errors are transient feedback and must use ToastViewport, not inline modal content'
    },
    {
      mutation: 'fetchAutomationScriptMutation',
      message:
        'Shelly script fetch progress/errors are transient feedback and must use ToastViewport, not inline modal content'
    }
  ];

  for (const path of hardwareSetupPagePaths) {
    const source = await readRepoFile(path);

    transientMutationRules.forEach(({ mutation, message }) => {
      const inlineErrorBeforeMutationPattern = new RegExp(
        `warning-box[\\s\\S]{0,700}${mutation}\\.(?:isError|error)`
      );
      const inlineErrorAfterMutationPattern = new RegExp(
        `${mutation}\\.(?:isError|error)[\\s\\S]{0,700}warning-box`
      );
      const inlinePendingPattern = new RegExp(
        `${mutation}\\.isPending[\\s\\S]{0,700}role="status"`
      );

      if (
        inlineErrorBeforeMutationPattern.test(source) ||
        inlineErrorAfterMutationPattern.test(source) ||
        inlinePendingPattern.test(source)
      ) {
        addFailure(path, message);
      }
    });
  }
};

const checkSelectControlPatterns = async () => {
  for (const path of hardwareSetupPagePaths) {
    const source = await readRepoFile(path);
    const selectMatches = source.matchAll(/<select\b/g);

    for (const match of selectMatches) {
      const index = match.index ?? 0;
      const precedingSource = source.slice(Math.max(0, index - 220), index);
      if (!precedingSource.includes('select-control')) {
        addFailure(
          path,
          'native select must be wrapped in select-control for tokenized field styling'
        );
      }
    }
  }
};

const checkResponsiveCss = async () => {
  const tokens = JSON.parse(
    await readRepoFile('packages/design-tokens/tokens/tokens.json')
  );
  const allowedBreakpoints = new Set(Object.values(tokens.breakpoint ?? {}));

  for (const path of responsiveCssPaths) {
    const source = await readRepoFile(path);
    const mediaQueries = source.matchAll(
      /@media\s*\(\s*(?:max-width|min-width):\s*([^)]+)\)/g
    );

    for (const match of mediaQueries) {
      const breakpoint = match[1].trim();
      if (!allowedBreakpoints.has(breakpoint)) {
        addFailure(path, `media query uses non-token breakpoint "${breakpoint}"`);
      }
    }

    if (cssPaths.includes(path)) {
      const blockedPatterns = [
        ['max-width: 920px', 'old fixed shell width'],
        ['max-width: 920px;', 'old fixed shell width'],
        ['max-width: 42rem', 'modal width must use --lcl-size-modal-max-width'],
        ['max-width: 28rem', 'toast width must use --lcl-size-toast-max-width'],
        ['@media (max-width: 700px)', 'old un-tokenized mobile breakpoint'],
        [
          'grid-template-columns: repeat(2, minmax(0, 1fr))',
          'fixed two-column grid instead of responsive auto-fit'
        ]
      ];

      blockedPatterns.forEach(([pattern, message]) => {
        if (source.includes(pattern)) {
          addFailure(path, message);
        }
      });
    }
  }

  const appTheme = await readRepoFile('apps/mobile/src/theme/theme.css');
  const actionRowStart = appTheme.indexOf('.action-row {');
  const actionRowEnd = appTheme.indexOf('}', actionRowStart);
  const actionRowSource =
    actionRowStart === -1 || actionRowEnd === -1
      ? ''
      : appTheme.slice(actionRowStart, actionRowEnd);

  if (!actionRowSource.includes('flex-wrap: wrap')) {
    addFailure(
      'apps/mobile/src/theme/theme.css',
      'action rows must wrap instead of overflowing on narrow screens'
    );
  }
};

const checkModalSizingPatterns = async () => {
  const uiThemePath = 'packages/ui/src/styles.css';
  const modalPath = 'packages/ui/src/primitives/Modal.tsx';
  const uiTheme = await readRepoFile(uiThemePath);
  const modalSource = await readRepoFile(modalPath);

  if (uiTheme.includes('--lcl-size-modal-diagnostic-min-height')) {
    addFailure(
      uiThemePath,
      'diagnostic modals must be content-sized; use workspace modal tokens for full-height previews'
    );
  }

  const diagnosticModalRule =
    uiTheme.match(/\.lcl-modal--diagnostic\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? '';
  if (/\b(?:height|min-height):/.test(diagnosticModalRule)) {
    addFailure(
      uiThemePath,
      'lcl-modal--diagnostic must not set height/min-height; compact diagnostics should shrink to content'
    );
  }

  if (
    !uiTheme.includes('.lcl-modal--workspace') ||
    !uiTheme.includes('--lcl-size-modal-workspace-min-height')
  ) {
    addFailure(
      uiThemePath,
      'full-height modal sizing must live in lcl-modal--workspace with workspace size tokens'
    );
  }

  if (!modalSource.includes("'workspace'")) {
    addFailure(
      modalPath,
      'Modal size union must include workspace for full-height previews'
    );
  }

  for (const path of feedbackContractPagePaths) {
    const source = await readRepoFile(path);
    const modalBlocks = source.matchAll(/<Modal\b[\s\S]*?<\/Modal>/g);

    for (const match of modalBlocks) {
      const block = match[0];
      const hasFillPreview = block.includes('variant="fill"');
      const hasWorkspaceSize = block.includes('size="workspace"');
      const hasDiagnosticSize = block.includes('size="diagnostic"');

      if (hasFillPreview && !hasWorkspaceSize) {
        addFailure(
          path,
          'ScriptPreview variant="fill" requires Modal size="workspace" so diagnostic modals stay content-sized'
        );
      }

      if (hasDiagnosticSize && hasFillPreview) {
        addFailure(
          path,
          'diagnostic modals must not contain fill previews; use size="workspace"'
        );
      }

      if (hasWorkspaceSize && !hasFillPreview) {
        addFailure(
          path,
          'workspace modals must be reserved for content that intentionally fills the modal body'
        );
      }
    }
  }
};

const checkThemeTokenPatterns = async () => {
  const tokenCssPath = 'packages/design-tokens/src/styles.css';
  const tokenSourcePath = 'packages/design-tokens/tokens/tokens.json';
  const appThemePath = 'apps/mobile/src/theme/theme.css';
  const uiThemePath = 'packages/ui/src/styles.css';
  const tokenCss = await readRepoFile(tokenCssPath);
  const tokenSource = JSON.parse(await readRepoFile(tokenSourcePath));
  const appTheme = await readRepoFile(appThemePath);
  const uiTheme = await readRepoFile(uiThemePath);

  if (!tokenCss.includes('color-scheme: light')) {
    addFailure(tokenCssPath, 'theme tokens must declare light color-scheme');
  }

  if (
    !tokenCss.includes('@media (prefers-color-scheme: dark)') ||
    !tokenCss.includes('color-scheme: dark')
  ) {
    addFailure(tokenCssPath, 'theme tokens must provide automatic dark mode');
  }

  if (!tokenCss.includes('--lcl-color-accent-contrast')) {
    addFailure(tokenCssPath, 'theme tokens must expose accent contrast color');
  }

  if (!tokenCss.includes('--lcl-color-code-text')) {
    addFailure(tokenCssPath, 'theme tokens must expose code text color');
  }

  if (!tokenSource.typography?.fontFamily?.startsWith('-apple-system')) {
    addFailure(tokenSourcePath, 'font family must start with the Apple system stack');
  }

  if (
    !appTheme.includes('--ion-color-primary-contrast: var(--lcl-color-accent-contrast)')
  ) {
    addFailure(appThemePath, 'Ionic primary contrast must use accentContrast token');
  }

  [appThemePath, uiThemePath].forEach((path) => {
    const source = path === appThemePath ? appTheme : uiTheme;
    if (/color:\s*var\(--lcl-color-surface\)/.test(source)) {
      addFailure(path, 'foreground text must not use surface token in dark mode');
    }
  });
};

const checkPackageRuntimeCopy = async () => {
  const blockedCopyPattern =
    /(['"`])(?:(?!\1).)*(?:[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]|Kopiuj|Temperatura|Wilgotność|Bateria|brak|zgodne|blokada|Skan BLE|zabrakło pamięci)(?:(?!\1).)*\1/;

  for (const path of packageRuntimeCopyPaths) {
    const source = await readRepoFile(path);
    source.split('\n').forEach((line, index) => {
      if (blockedCopyPattern.test(line)) {
        addFailure(
          path,
          `line ${index + 1} contains package-level user-facing copy; pass copy from the app layer`
        );
      }
    });
  }
};

await checkSavedShellyCardFeedback();
await checkTokenizedCss();
await checkFeedbackContractPatterns();
await checkUiPackageFeedbackPatterns();
await checkFieldValidationPatterns();
await checkTransientFeedbackPatterns();
await checkSelectControlPatterns();
await checkResponsiveCss();
await checkModalSizingPatterns();
await checkThemeTokenPatterns();
await checkPackageRuntimeCopy();

if (failures.length > 0) {
  console.error('UX quality gate failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('UX quality gate passed.');
