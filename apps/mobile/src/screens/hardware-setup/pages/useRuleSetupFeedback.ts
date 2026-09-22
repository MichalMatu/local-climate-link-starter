import type { ToastTone } from '@lcl/ui';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Translate } from '../../../app/i18n.js';
import { mutationError } from '../helpers.js';
import type { RuleSetupFlow } from '../pageContracts.js';

export type RuleDialogState =
  'none' | 'script' | 'install-block' | 'relay-test' | 'restore';

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
