from pathlib import Path

ROOT = Path('.')

def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count), encoding='utf-8')

# 1) BLE regression: keep cleanup stable across candidate-driven rerenders.
phone_flow = 'apps/mobile/src/flows/hardware-setup/usePhoneSensorFlow.ts'
replace(
    phone_flow,
    """  const stopPhoneBleScan = () => {
    void phoneBleScannerRef.current?.stopScan();
  };""",
    """  const stopPhoneBleScan = useCallback(() => {
    void phoneBleScannerRef.current?.stopScan();
  }, []);""",
)

sensor_page = 'apps/mobile/src/screens/hardware-setup/pages/SensorSetupPage.tsx'
replace(
    sensor_page,
    """  const autoScanStartedRef = useRef(false);
  const { dismissToast, pushToast, toasts } = useToastQueue('sensor-toast');""",
    """  const autoScanStartedRef = useRef(false);
  const startPhoneBleScanRef = useRef<() => void>(() => undefined);
  const stopPhoneBleScanRef = useRef<() => void>(() => undefined);
  const { dismissToast, pushToast, toasts } = useToastQueue('sensor-toast');""",
)
replace(
    sensor_page,
    """  const startPhoneBleScan = () => {
    resetPhoneBleError();
    flow.startPhoneBleScan();
  };

  useEffect(() => {
    if (!addOnly || primaryAddAction !== 'phone-scan' || autoScanStartedRef.current)
      return;
    autoScanStartedRef.current = true;
    startPhoneBleScan();
  }, [addOnly, primaryAddAction]);

  useEffect(
    () => () => {
      if (addOnly) flow.stopPhoneBleScan();
    },
    [addOnly, flow.stopPhoneBleScan]
  );""",
    """  const startPhoneBleScan = () => {
    resetPhoneBleError();
    flow.startPhoneBleScan();
  };
  startPhoneBleScanRef.current = startPhoneBleScan;
  stopPhoneBleScanRef.current = flow.stopPhoneBleScan;

  useEffect(() => {
    if (!addOnly || primaryAddAction !== 'phone-scan' || autoScanStartedRef.current)
      return;
    autoScanStartedRef.current = true;
    startPhoneBleScanRef.current();
  }, [addOnly, primaryAddAction]);

  useEffect(
    () => () => {
      if (addOnly) stopPhoneBleScanRef.current();
    },
    [addOnly]
  );""",
)

# 2) Real fixed app shell: document does not scroll; only content does; nav is its own bottom row.
app_shell = 'apps/mobile/src/components/AppShell.tsx'
replace(
    app_shell,
    """  <div className=\"app-root-shell app-bottom-nav-shell\">
    {children}
    <AppBottomNavigation""",
    """  <div className=\"app-root-shell app-bottom-nav-shell\">
    <div className=\"app-root-shell__content\">{children}</div>
    <AppBottomNavigation""",
)

(ROOT / 'apps/mobile/src/components/AppBottomNavigation.css').write_text(""".app-root-shell {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.app-root-shell__content {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

.app-bottom-nav-shell {
  --app-bottom-nav-height: calc(
    var(--lcl-size-control-min-height) + var(--lcl-spacing-lg)
  );
  --app-toast-bottom-gap: var(--lcl-spacing-xs);
}

.app-bottom-nav-shell .lcl-toast-viewport {
  bottom: calc(
    var(--app-bottom-nav-height) + var(--app-toast-bottom-gap) +
      env(safe-area-inset-bottom)
  );
}

.app-bottom-nav {
  align-items: stretch;
  background: var(--lcl-color-surface);
  border-top: var(--lcl-border-width-sm) solid var(--lcl-color-border);
  box-shadow: var(--lcl-shadow-sm);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-height: var(--app-bottom-nav-height);
  padding: var(--lcl-spacing-xs) var(--lcl-fluid-shell-padding)
    calc(var(--lcl-spacing-xs) + env(safe-area-inset-bottom));
  position: relative;
  width: 100%;
  z-index: var(--lcl-z-index-header);
}

.app-bottom-nav__item {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: var(--lcl-radius-md);
  color: var(--lcl-color-text-muted);
  cursor: pointer;
  display: grid;
  font-size: var(--lcl-font-size-xs);
  font-weight: var(--lcl-font-weight-semibold);
  gap: var(--lcl-spacing-xs);
  justify-items: center;
  min-width: 0;
  padding: var(--lcl-spacing-xs) var(--lcl-spacing-sm);
}

.app-bottom-nav__item[aria-current='page'],
.app-bottom-nav__item:hover,
.app-bottom-nav__item:focus-visible {
  color: var(--lcl-color-accent);
}

.app-bottom-nav__item:disabled {
  cursor: not-allowed;
  opacity: var(--lcl-opacity-disabled);
}

.app-bottom-nav__icon {
  height: var(--lcl-size-control-icon-size);
  width: var(--lcl-size-control-icon-size);
}
""", encoding='utf-8')

(ROOT / 'apps/mobile/src/app/appShell.css').write_text(""".app-shell {
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
""", encoding='utf-8')

# 3) Regression coverage: delay advertisements so candidate rerenders can expose accidental cleanup.
test = 'apps/mobile/src/__tests__/hardware-setup.test.tsx'
replace(
    test,
    """  endContinuousScanCount: 0
}));""",
    """  endContinuousScanCount: 0,
  advertisementDelayMs: 0
}));""",
)
replace(
    test,
    """        yield advertisement;
      }

      if (options?.timeoutMs === 0""",
    """        yield advertisement;
        if (phoneBleScannerMock.advertisementDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, phoneBleScannerMock.advertisementDelayMs)
          );
        }
      }

      if (options?.timeoutMs === 0""",
)
# Add focused regression right before the existing full BLE child-page test.
marker = """  it('uses the thermometer add child page for phone BLE scan and keeps result order stable', async () => {"""
insert = """  it('keeps the BLE add-page scan alive across candidate rerenders', async () => {
    phoneBleScannerMock.advertisementDelayMs = 60;
    renderHardwareSetup({ sensorAddOnly: true, sensorAddMode: 'phone-scan' });

    expect(await screen.findByText('A4:C1:38:4F:24:CD')).toBeInTheDocument();
    expect(await screen.findByText('F7:5F:8D:0F:76:20')).toBeInTheDocument();
  });

""" + marker
replace(test, marker, insert)

print('BLE scan and fixed app shell regression fixes applied')
