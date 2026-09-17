from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

# 1) Thermometer add action uses the same dashboard FAB surface as Plugs.
path = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace(
    path,
    '        className="primary-action setup-add-fab"',
    "        className={\n          primaryAddAction === 'phone-scan'\n            ? 'primary-action dashboard-fab'\n            : 'primary-action setup-add-fab'\n        }",
)
replace(
    path,
    '        <IconPlus className="setup-add-fab__icon" aria-hidden="true" />',
    "        <IconPlus\n          className={\n            primaryAddAction === 'phone-scan'\n              ? 'dashboard-fab__icon'\n              : 'setup-add-fab__icon'\n          }\n          aria-hidden=\"true\"\n        />",
)

# 2) Make InfoTooltip viewport-safe everywhere, not only in the network scanner.
path = 'packages/ui/src/styles.css'
old = """  max-width: min(
    var(--lcl-size-tooltip-max-width),
    calc(100vw - (var(--lcl-spacing-xl) * 2))
  );
  opacity: 0;
"""
new = """  box-sizing: border-box;
  max-width: min(
    var(--lcl-size-tooltip-max-width),
    calc(100vw - (var(--lcl-spacing-lg) * 2))
  );
  opacity: 0;
  overflow-wrap: anywhere;
"""
replace(path, old, new)
replace(
    path,
    '  width: max-content;\n  z-index: var(--lcl-z-index-toast);',
    "  width: min(\n    var(--lcl-size-tooltip-max-width),\n    calc(100vw - (var(--lcl-spacing-lg) * 2))\n  );\n  z-index: var(--lcl-z-index-toast);",
)

# 3) When a plug-settings modal already renders the same connection problem inline,
# acknowledge its control feedback without also showing a duplicate transient toast.
path = 'apps/mobile/src/screens/hardware-setup/pages/useShellySetupFeedback.ts'
replace(
    path,
    """type ShellySetupFeedbackOptions = {
  flow: ShellySetupFlow;
  isBleScanModalOpen: boolean;
  pushToast: PushToast;
  t: Translate;
};
""",
    """type ShellySetupFeedbackOptions = {
  flow: ShellySetupFlow;
  isBleScanModalOpen: boolean;
  pushToast: PushToast;
  suppressControlFeedbackDeviceId?: string | null;
  t: Translate;
};
""",
)
replace(
    path,
    """  flow,
  isBleScanModalOpen,
  pushToast,
  t
}: ShellySetupFeedbackOptions) => {
""",
    """  flow,
  isBleScanModalOpen,
  pushToast,
  suppressControlFeedbackDeviceId = null,
  t
}: ShellySetupFeedbackOptions) => {
""",
)
replace(
    path,
    """      shownControlFeedbackRef.current[deviceId] = feedbackKey;
      pushToast(controlState.error ? 'warning' : 'ok', message);
      flow.acknowledgeShellyControlFeedback(deviceId, controlState.updatedAtMs, message);
""",
    """      shownControlFeedbackRef.current[deviceId] = feedbackKey;
      if (deviceId !== suppressControlFeedbackDeviceId) {
        pushToast(controlState.error ? 'warning' : 'ok', message);
      }
      flow.acknowledgeShellyControlFeedback(deviceId, controlState.updatedAtMs, message);
""",
)
replace(
    path,
    """  }, [flow.acknowledgeShellyControlFeedback, flow.shellyControlStates, pushToast]);
""",
    """  }, [
    flow.acknowledgeShellyControlFeedback,
    flow.shellyControlStates,
    pushToast,
    suppressControlFeedbackDeviceId
  ]);
""",
)

path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    path,
    """  const { resetBleStopError } = useShellySetupFeedback({
    flow,
    isBleScanModalOpen,
    pushToast,
    t
  });
""",
    """  const { resetBleStopError } = useShellySetupFeedback({
    flow,
    isBleScanModalOpen,
    pushToast,
    suppressControlFeedbackDeviceId: settingsOnlyDeviceId ?? null,
    t
  });
""",
)
