from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

# Persist detected hardware identity without breaking old v8 localStorage entries.
path = 'apps/mobile/src/flows/hardware-setup/setupDraftStore.ts'
replace(
    path,
    """const shellyDraftDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  scriptIdInput: z.string()
});""",
    """const shellyDraftDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  scriptIdInput: z.string(),
  model: z.string().optional(),
  gen: z.number().int().nonnegative().optional()
});"""
)
replace(
    path,
    """  setShellyDeviceName(id: string, name: string): void;
  setShellyScriptId(id: string, scriptIdInput: string): void;""",
    """  setShellyDeviceName(id: string, name: string): void;
  setShellyDeviceMetadata(id: string, metadata: { model: string; gen: number }): void;
  setShellyScriptId(id: string, scriptIdInput: string): void;"""
)
replace(
    path,
    """    setShellyDeviceName: (id, name) =>
      set((state) => {
        const shellyDevices = updateListItem(state.shellyDevices, id, { name });
        return persistPatch(state, { shellyDevices });
      }),
    setShellyScriptId: (id, scriptIdInput) =>""",
    """    setShellyDeviceName: (id, name) =>
      set((state) => {
        const shellyDevices = updateListItem(state.shellyDevices, id, { name });
        return persistPatch(state, { shellyDevices });
      }),
    setShellyDeviceMetadata: (id, metadata) =>
      set((state) => {
        const shellyDevices = updateListItem(state.shellyDevices, id, metadata);
        return persistPatch(state, { shellyDevices });
      }),
    setShellyScriptId: (id, scriptIdInput) =>"""
)

# Save model/gen on add and refresh the cached identity after a successful recheck.
path = 'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts'
replace(
    path,
    """  const setShellyDeviceName = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceName
  );
  const setShellyScriptIdDraft = useHardwareSetupDraftStore(""",
    """  const setShellyDeviceName = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceName
  );
  const setShellyDeviceMetadata = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceMetadata
  );
  const setShellyScriptIdDraft = useHardwareSetupDraftStore("""
)
replace(
    path,
    """        checkedDevice: {
          id: baseUrl,
          name,
          baseUrl,
          scriptIdInput: existingScript ? String(existingScript.id) : '1'
        }""",
    """        checkedDevice: {
          id: baseUrl,
          name,
          baseUrl,
          scriptIdInput: existingScript ? String(existingScript.id) : '1',
          model: status.deviceInfo.model,
          gen: status.deviceInfo.gen
        }"""
)
replace(
    path,
    """    onSuccess: (status, device) => {
      setSetupStatus(status);
      applyControlStatus(device, shellyControlStatusFromSetupStatus(status), null);
    },""",
    """    onSuccess: (status, device) => {
      setSetupStatus(status);
      setShellyDeviceMetadata(device.id, {
        model: status.deviceInfo.model,
        gen: status.deviceInfo.gen
      });
      applyControlStatus(device, shellyControlStatusFromSetupStatus(status), null);
    },"""
)

# Keep the compact hardware card stable and place compatibility beside model/gen.
path = 'packages/ui/src/primitives/ShellyCard.tsx'
replace(
    path,
    """    <div className=\"lcl-compact-device__header\">
      <strong>{name}</strong>
      <span>{model}</span>
      <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
    </div>""",
    """    <div className=\"lcl-compact-device__header\">
      <strong>{name}</strong>
      <div className=\"lcl-compact-device__meta\">
        <span>{model}</span>
        <StatusBadge tone={badgeTone}>{badgeLabel}</StatusBadge>
      </div>
    </div>"""
)

path = 'packages/ui/src/styles.css'
replace(
    path,
    """.lcl-compact-device__header {
  align-items: center;
  display: grid;
  gap: var(--lcl-spacing-xs) var(--lcl-spacing-sm);
  grid-template-columns: minmax(0, auto) minmax(0, 1fr) auto;
}

.lcl-compact-device__header strong {
  font-size: var(--lcl-font-size-lg);
  line-height: var(--lcl-line-height-compact);
}

.lcl-compact-device__header span {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  min-width: 0;
  overflow-wrap: anywhere;
}""",
    """.lcl-compact-device__header {
  display: grid;
  gap: var(--lcl-spacing-xs);
}

.lcl-compact-device__header strong {
  font-size: var(--lcl-font-size-lg);
  line-height: var(--lcl-line-height-compact);
}

.lcl-compact-device__meta {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-sm);
  justify-content: space-between;
  min-width: 0;
}

.lcl-compact-device__meta > span:first-child {
  color: var(--lcl-color-text-muted);
  font-size: var(--lcl-font-size-sm);
  min-width: 0;
  overflow-wrap: anywhere;
}

.lcl-compact-device__meta .lcl-status-badge {
  flex: 0 0 auto;
}"""
)
replace(
    path,
    """
  .lcl-compact-device__header {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .lcl-compact-device__header span {
    grid-column: 1 / -1;
  }
""",
    "\n"
)

# Settings: no transient connecting row and no late-mounting capability card.
path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    path,
    """            {flow.recheckShellyMutation.isPending && (
              <p>{t('hardware.shelly.localRpcConnecting')}</p>
            )}
            {flow.recheckShellyMutation.isError && (""",
    """            {flow.recheckShellyMutation.isError && ("""
)
old = """            {!flow.recheckShellyMutation.isPending &&
              !flow.recheckShellyMutation.isError &&
              flow.setupStatus && (
                <ShellyCard
                  name={infoShelly.name}
                  model={`${flow.setupStatus.deviceInfo.model}, gen ${flow.setupStatus.deviceInfo.gen}`}
                  badgeLabel={compatibilityBadge.label}
                  badgeTone={compatibilityBadge.tone}
                  rows={[
                    {
                      label: 'Scripts',
                      value: formatComponentState(flow.setupStatus.status.scripts, t)
                    },
                    {
                      label: 'Bluetooth',
                      value: formatComponentState(flow.setupStatus.status.bluetooth, t)
                    },
                    {
                      label: t('hardware.shelly.matter'),
                      value: flow.setupStatus.status.matterEnabled
                        ? t('common.enabled')
                        : t('common.disabled')
                    }
                  ]}
                />
              )}"""
new = """            <ShellyCard
              name={infoShelly.name}
              model={
                (flow.setupStatus?.deviceInfo.model ?? infoShelly.model)
                  ? `${flow.setupStatus?.deviceInfo.model ?? infoShelly.model}, gen ${flow.setupStatus?.deviceInfo.gen ?? infoShelly.gen ?? '?'}`
                  : t('common.missingData')
              }
              badgeLabel={compatibilityBadge.label}
              badgeTone={compatibilityBadge.tone}
              rows={[
                {
                  label: 'Scripts',
                  value: flow.setupStatus
                    ? formatComponentState(flow.setupStatus.status.scripts, t)
                    : t('common.missingData')
                },
                {
                  label: 'Bluetooth',
                  value: flow.setupStatus
                    ? formatComponentState(flow.setupStatus.status.bluetooth, t)
                    : t('common.missingData')
                },
                {
                  label: t('hardware.shelly.matter'),
                  value: flow.setupStatus
                    ? flow.setupStatus.status.matterEnabled
                      ? t('common.enabled')
                      : t('common.disabled')
                    : t('common.missingData')
                }
              ]}
            />"""
replace(path, old, new)

# Restore inline rename on the main plain Plug card, matching thermometer UX.
path = 'apps/mobile/src/screens/AutomationDashboardScreen.tsx'
replace(
    path,
    """  IconDotsVertical,
  IconPlug,
  IconPlus,""",
    """  IconDotsVertical,
  IconPencil,
  IconPlug,
  IconPlus,"""
)
replace(
    path,
    """  onAddAutomation,
  onOpenSettings
}: {
  device: ShellyDraftDevice;
  onAddAutomation(): void;
  onOpenSettings(): void;
}) => {""",
    """  onAddAutomation,
  onOpenSettings,
  onNameChange
}: {
  device: ShellyDraftDevice;
  onAddAutomation(): void;
  onOpenSettings(): void;
  onNameChange(value: string): void;
}) => {"""
)
replace(
    path,
    """  const { t } = useTranslation();
  const { shellyControlStates, refreshShellyControl, turnRelayOn, turnRelayOff } =""",
    """  const { t } = useTranslation();
  const [isEditingName, setIsEditingName] = useState(false);
  const { shellyControlStates, refreshShellyControl, turnRelayOn, turnRelayOff } ="""
)
replace(
    path,
    """        <div className=\"automation-card__identity\">
          <h2>{device.name}</h2>
          <p>{t('dashboard.emptyCategory')}</p>
        </div>""",
    """        <div className=\"automation-card__identity\">
          {isEditingName ? (
            <input
              autoFocus
              className=\"plug-card__name-input\"
              aria-label={t('hardware.shelly.deviceNameLabel')}
              type=\"text\"
              value={device.name}
              onBlur={() => setIsEditingName(false)}
              onChange={(event) => onNameChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.currentTarget.blur();
                }
              }}
            />
          ) : (
            <div className=\"plug-card__title-row\">
              <h2>{device.name}</h2>
              <button
                className=\"icon-action rule-summary-icon-action plug-card__rename\"
                type=\"button\"
                aria-label={t('hardware.shelly.deviceNameLabel')}
                title={t('hardware.shelly.deviceNameLabel')}
                onClick={() => setIsEditingName(true)}
              >
                <IconPencil className=\"icon-action__svg\" aria-hidden=\"true\" />
              </button>
            </div>
          )}
          <p>{t('dashboard.emptyCategory')}</p>
        </div>"""
)
replace(
    path,
    """  const shellyDevices = useHardwareSetupDraftStore((state) => state.shellyDevices);
  const queryClient = useQueryClient();""",
    """  const shellyDevices = useHardwareSetupDraftStore((state) => state.shellyDevices);
  const setShellyDeviceName = useHardwareSetupDraftStore(
    (state) => state.setShellyDeviceName
  );
  const queryClient = useQueryClient();"""
)
replace(
    path,
    """                  onAddAutomation={() => onAddAutomation('climate', device.id)}
                  onOpenSettings={() => setSettingsDeviceId(device.id)}
                />""",
    """                  onAddAutomation={() => onAddAutomation('climate', device.id)}
                  onOpenSettings={() => setSettingsDeviceId(device.id)}
                  onNameChange={(value) => setShellyDeviceName(device.id, value)}
                />"""
)

path = 'apps/mobile/src/screens/AutomationDashboardScreen.css'
replace(
    path,
    """.dashboard-shell .plug-card__automation-action {
  width: 100%;
}""",
    """.plug-card__title-row {
  align-items: center;
  display: flex;
  gap: var(--lcl-spacing-xs);
  min-width: 0;
}

.plug-card__title-row h2 {
  flex: 0 1 auto;
  min-width: 0;
}

.dashboard-shell .plug-card__rename {
  flex: 0 0 auto;
  height: var(--lcl-size-compact-control-min-height);
  width: var(--lcl-size-compact-control-min-height);
}

.plug-card__name-input {
  background: var(--lcl-color-surface-muted);
  border: var(--lcl-border-width-sm) solid var(--lcl-color-accent);
  border-radius: var(--lcl-radius-sm);
  color: var(--lcl-color-text);
  font-size: var(--lcl-font-size-2xl);
  font-weight: var(--lcl-font-weight-bold);
  line-height: var(--lcl-line-height-tight);
  min-width: 0;
  padding: var(--lcl-spacing-xs) var(--lcl-spacing-sm);
  width: 100%;
}

.dashboard-shell .plug-card__automation-action {
  width: 100%;
}"""
)

# Regression coverage: rename and hardware metadata caching/stable capability card.
path = 'apps/mobile/src/__tests__/automation-dashboard.test.tsx'
replace(
    path,
    """    const plugCard = card as HTMLElement;
    expect(within(plugCard).getByText('Brak automatyzacji')).toBeVisible();
    expect(await within(plugCard).findByText('0.0 W')).toBeVisible();""",
    """    const plugCard = card as HTMLElement;
    expect(within(plugCard).getByText('Brak automatyzacji')).toBeVisible();
    fireEvent.click(
      within(plugCard).getByRole('button', { name: 'Nazwa gniazdka' })
    );
    const nameInput = within(plugCard).getByRole('textbox', { name: 'Nazwa gniazdka' });
    fireEvent.change(nameInput, { target: { value: 'Nawilżacz salon' } });
    fireEvent.blur(nameInput);
    expect(within(plugCard).getByText('Nawilżacz salon')).toBeVisible();
    expect(
      useHardwareSetupDraftStore.getState().shellyDevices[0]?.name
    ).toBe('Nawilżacz salon');
    expect(await within(plugCard).findByText('0.0 W')).toBeVisible();"""
)
replace(
    path,
    """    fireEvent.click(
      within(plugCard).getByRole('button', { name: 'Ustawienia gniazdka: Nawilżacz' })
    );
    const settingsDialog = await screen.findByRole('dialog', { name: 'Nawilżacz' });
    expect(""",
    """    fireEvent.click(
      within(plugCard).getByRole('button', {
        name: 'Ustawienia gniazdka: Nawilżacz salon'
      })
    );
    const settingsDialog = screen.getByRole('dialog', { name: 'Nawilżacz salon' });
    expect(settingsDialog.querySelector('.lcl-compact-device')).not.toBeNull();
    expect(await within(settingsDialog).findByText('S3PL-00112EU, gen 3')).toBeVisible();
    expect(within(settingsDialog).getByText('KOMPATYBILNE')).toBeVisible();
    await waitFor(() =>
      expect(useHardwareSetupDraftStore.getState().shellyDevices[0]).toMatchObject({
        model: 'S3PL-00112EU',
        gen: 3
      })
    );
    expect("""
)
