// Reviewed architecture baselines. These values describe the accepted repository state,
// not spare capacity. Raising one is an architecture change; lowering one after a file
// shrinks is encouraged.

export const allowedPackageDependencies = Object.freeze({
  '@lcl/automation-core': [],
  '@lcl/ble-core': ['@lcl/device-profiles'],
  '@lcl/design-tokens': [],
  '@lcl/device-profiles': [],
  '@lcl/diagnostics': [],
  '@lcl/script-generator': ['@lcl/automation-core', '@lcl/device-profiles'],
  '@lcl/shelly-client': ['@lcl/diagnostics'],
  '@lcl/ui': ['@lcl/design-tokens']
});

export const defaultProductionModuleMaxLines = 350;

export const mobileProductionBaselines = Object.freeze({
  'apps/mobile/src/screens/AutomationDashboardScreen.tsx': 600,
  'apps/mobile/src/screens/InstallationDetailScreen.tsx': 458,
  'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx': 416,
  'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPresentation.tsx': 411,
  'apps/mobile/src/screens/hardware-setup/HardwareSetupScreen.tsx': 353
});

export const packageProductionBaselines = Object.freeze({});

export const legacyProductionPaths = Object.freeze({
  'apps/mobile/src/screens': [
    'AutomationDashboardScreen.tsx',
    'InstallationDetailScreen.tsx',
    'InstallationDiagnosticsScreen.tsx',
    'InstallationScriptScreen.tsx',
    'PlugBleDiscoveryScreen.tsx',
    'PlugSettingsScreen.tsx',
    'SetupIntentScreen.tsx',
    'ShellyLedSettingsCard.tsx',
    'TimeAutomationCard.tsx',
    'TimeInstallationDetail.tsx',
    'hardware-setup/HardwareSetupScreen.tsx',
    'hardware-setup/helpers.ts',
    'hardware-setup/pageContracts.ts',
    'hardware-setup/pages/RuleSetupPage.tsx',
    'hardware-setup/pages/SensorSetupPage.tsx',
    'hardware-setup/pages/SensorSetupPresentation.tsx',
    'hardware-setup/pages/ShellyBleDiscoveryContent.tsx',
    'hardware-setup/pages/ShellyBleDiscoveryModal.tsx',
    'hardware-setup/pages/ShellySettingsContent.tsx',
    'hardware-setup/pages/ShellySettingsModal.tsx',
    'hardware-setup/pages/ShellySetupPage.tsx',
    'hardware-setup/pages/ShellySetupPresentation.tsx',
    'hardware-setup/pages/TimeScheduleSetupPage.tsx',
    'hardware-setup/pages/useRuleSetupFeedback.ts',
    'hardware-setup/pages/useSensorSetupFeedback.ts',
    'hardware-setup/pages/useShellySetupFeedback.ts',
    'hardware-setup/useToastQueue.ts'
  ],
  'apps/mobile/src/flows': [
    'hardware-setup/phoneBleScan.ts',
    'hardware-setup/resourceDiagnostics.ts',
    'hardware-setup/ruleConfigDerivation.ts',
    'hardware-setup/schemas.ts',
    'hardware-setup/sensorReadingsStore.ts',
    'hardware-setup/setupDraftStore.ts',
    'hardware-setup/shellyRequests.ts',
    'hardware-setup/useClimateAutomationInstallFlow.ts',
    'hardware-setup/useHardwareSetupFlow.ts',
    'hardware-setup/usePhoneSensorFlow.ts',
    'hardware-setup/usePlainShellyRuntime.ts',
    'hardware-setup/useRuleSensorReadings.ts',
    'hardware-setup/useSavedSensorLiveScanLifecycle.ts',
    'hardware-setup/useShellyBleDiscoveryFlow.ts',
    'hardware-setup/useShellyControlFlow.ts',
    'hardware-setup/useShellySetupScanFlow.ts',
    'hardware-setup/validation.ts',
    'installations/deviceLed.ts',
    'installations/diagnosticPresentation.ts',
    'installations/healthRecovery.ts',
    'installations/model.ts',
    'installations/presentation.ts',
    'installations/relaySafety.ts',
    'installations/repository.ts',
    'installations/runtimeControl.ts',
    'installations/runtimeDiagnostics.ts',
    'installations/runtimeModeTransport.ts',
    'installations/runtimeStatus.ts',
    'installations/runtimeUpgrade.ts',
    'installations/scriptPreview.ts',
    'installations/store.ts',
    'installations/useInstalledAutomationRuntime.ts',
    'setup-intent.ts',
    'time-automation/config.ts',
    'time-automation/useTimeAutomationRuntime.ts',
    'time-automation/useTimeAutomationSetupFlow.ts'
  ],
  'apps/mobile/src/components': [
    'AppBottomNavigation.tsx',
    'AppPageBack.tsx',
    'AppShell.tsx',
    'AppToastViewport.tsx',
    'EditablePlugName.tsx',
    'RefreshIconButton.tsx',
    'icons/CodeIcon.tsx'
  ]
});

export const allowedFeatureDependencies = Object.freeze({});

export const sharedStylesheetBaselines = Object.freeze({
  'apps/mobile/src/theme/theme.css': 3322,
  'packages/ui/src/styles.css': 672
});
