export {
  ClimateAutomationDetailSection,
  ClimateRecoverySection,
  ClimateBleDetailSection,
  ClimateScriptDetailSection,
  ClimateScriptDiagnosticsSection,
  type ClimateBleSensorView,
  type ClimateScriptDiagnosticRow
} from './components/ClimateInstallationDetailSections.js';
export {
  readShellyAutomationScriptState,
  readShellyControlStatus,
  readShellyManagedAutomationScriptCode,
  type ShellyAutomationMode,
  type ShellyAutomationScriptState,
  type ShellyControlStatus
} from './data/shellyManagedAutomation.js';

export {
  deleteTimeAutomation,
  installDailyTimeAutomation,
  pauseTimeAutomation,
  resumeTimeAutomation,
  TimeAutomationRuntimeError,
  updateDailyTimeAutomation
} from './data/timeAutomationRuntime.js';
export {
  readTimeAutomationRuntime,
  type TimeAutomationRuntimeSnapshot
} from './data/timeAutomationRuntimeState.js';
export { findScheduleRelayConflict } from './data/timeAutomationSchedule.js';
export {
  DEFAULT_RULE_ADVANCED_SETTINGS,
  RULE_ADVANCED_LIMITS,
  parseRuleAdvancedSettings,
  validateRuleAdvancedSettings,
  type RuleAdvancedSettingsInput,
  type RuleAdvancedSettingsValidation
} from './data/climateRuleSettings.js';
export {
  ClimateRuleEditor,
  type ClimateRuleEditorProps,
  type ClimateRuleLiveReading
} from './components/ClimateRuleEditor.js';
export { ALL_RULE_PRESETS } from './presentation/climateRulePresentation.js';
export {
  useClimateAutomationScriptLoadFlow,
  type ClimateAutomationScriptLoadResult,
  type ClimateAutomationScriptLoadTarget
} from './flows/useClimateAutomationScriptLoadFlow.js';
export { useClimateAutomationScriptLoadDraftFlow } from './flows/useClimateAutomationScriptLoadDraftFlow.js';

export {
  dailyScheduleTimespec,
  dailyTimeAutomationConfigSchema,
  expectedRelayOnForClockTime,
  parseClockMinutes,
  type DailyTimeAutomationConfig
} from './data/timeAutomationConfig.js';
export { createClimateAutomationEditDraftPatch } from './data/climateAutomationEditDraft.js';
export {
  removeSensorSelection,
  selectSensorSelection,
  setAdditionalSensorSelection,
  toggleAdditionalSensorSelection,
  upsertSensorSelection,
  validAdditionalSensorIds,
  type SensorDraftActions
} from './data/climateSensorDraftSelection.js';
export {
  INSTALLED_AUTOMATION_VERSION,
  climateInstalledAutomationSchema,
  createInstalledAutomation,
  createInstalledAutomationId,
  createTimeInstalledAutomation,
  createTimeInstalledAutomationId,
  findInstalledRelayOwner,
  findRelayOwnerConflict,
  installedAutomationRelayId,
  installedAutomationSchema,
  timeInstalledAutomationSchema,
  type ClimateInstalledAutomation,
  type InstalledAutomation,
  type InstalledAutomationKind,
  type TimeInstalledAutomation
} from './data/installedAutomation.js';
export {
  INSTALLED_AUTOMATIONS_STORAGE_KEY,
  createInstalledAutomationRepository,
  type InstalledAutomationRepository
} from './data/installedAutomationRepository.js';
export {
  reconcileInstalledAutomationsForShelly,
  type InstalledAutomationReconciliationResult,
  type InstalledAutomationReconciliationStatus,
  type RecoveredAutomationSensor
} from './flows/reconcileInstalledAutomation.js';
export {
  updateClimateInstalledAutomation,
  type ClimateAutomationEditServices
} from './flows/updateClimateInstalledAutomation.js';
export {
  updateTimeInstalledAutomation,
  type TimeAutomationEditServices
} from './flows/updateTimeInstalledAutomation.js';
export {
  resetInstalledAutomationStore,
  useInstalledAutomationStore
} from './state/installedAutomationStore.js';
