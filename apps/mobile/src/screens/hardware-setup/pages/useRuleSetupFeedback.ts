import type { ToastTone } from '@lcl/ui';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Translate } from '../../../app/i18n.js';
import { mutationError } from '../helpers.js';
import type { RuleSetupFlow } from '../pageContracts.js';

export type RuleDialogState =
  | 'none'
  | 'summary'
  | 'vpd-info'
  | 'script'
  | 'advanced'
  | 'delete'
  | 'install-block'
  | 'relay-test';

type PushToast = (tone: ToastTone, title: string, detail?: string) => void;

type RuleSetupFeedbackOptions = {
  flow: RuleSetupFlow;
  pushToast: PushToast;
  setDialog: Dispatch<SetStateAction<RuleDialogState>>;
  t: Translate;
};

export const useRuleSetupFeedback = ({
  flow,
  pushToast,
  setDialog,
  t
}: RuleSetupFeedbackOptions): void => {
  useEffect(() => {
    setDialog((current) => (current === 'delete' ? 'none' : current));
  }, [flow.selectedShellyId, setDialog]);

  useEffect(() => {
    if (!flow.loadAutomationScriptMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.readScriptFailedTitle'),
      mutationError(flow.loadAutomationScriptMutation.error)
    );
    flow.loadAutomationScriptMutation.reset();
  }, [flow.loadAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.loadAutomationScriptMutation.isSuccess) {
      return;
    }
    pushToast('ok', t('hardware.rule.loadScriptDone'));
    flow.loadAutomationScriptMutation.reset();
  }, [flow.loadAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.deleteAutomationScriptMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.deleteScriptFailedTitle'),
      mutationError(flow.deleteAutomationScriptMutation.error)
    );
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.deleteAutomationScriptMutation.isSuccess) {
      return;
    }
    setDialog('none');
    pushToast('ok', t('hardware.rule.deleteScriptDone'));
    flow.deleteAutomationScriptMutation.reset();
  }, [flow.deleteAutomationScriptMutation, pushToast, setDialog, t]);

  useEffect(() => {
    if (!flow.installMutation.isError) {
      return;
    }
    setDialog('install-block');
  }, [flow.installMutation.error, flow.installMutation.isError, setDialog]);

  useEffect(() => {
    if (!flow.installMutation.isSuccess || !flow.canRunSafeRelayTest) {
      return;
    }
    setDialog('relay-test');
    flow.installMutation.reset();
  }, [flow.canRunSafeRelayTest, flow.installMutation, setDialog]);

  useEffect(() => {
    if (!flow.safeRelayTestMutation.isError) {
      return;
    }
    pushToast(
      'warning',
      t('hardware.rule.relayTestFailedTitle'),
      mutationError(flow.safeRelayTestMutation.error)
    );
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast, t]);

  useEffect(() => {
    if (!flow.safeRelayTestMutation.isSuccess) {
      return;
    }
    setDialog('none');
    pushToast('ok', t('hardware.ready'), t('hardware.rule.relayTestDone'));
    flow.safeRelayTestMutation.reset();
  }, [flow.safeRelayTestMutation, pushToast, setDialog, t]);
};
