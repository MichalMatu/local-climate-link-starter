from pathlib import Path

p = Path('apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx')
s = p.read_text()
s = s.replace(
    "import { useEffect, useId, useState } from 'react';",
    "import { useEffect, useId, useRef, useState } from 'react';",
)
s = s.replace(
    "  const recheckShelly = flow.recheckShellyMutation.mutate;\n"
    "  const resetRecheckShelly = flow.recheckShellyMutation.reset;\n",
    "  const settingsOnlyShelly =\n"
    "    settingsOnlyDeviceId == null\n"
    "      ? null\n"
    "      : (shellyDevices.find((device) => device.id === settingsOnlyDeviceId) ?? null);\n"
    "  const settingsOnlyShellyRef = useRef(settingsOnlyShelly);\n"
    "  const recheckShellyRef = useRef(flow.recheckShellyMutation.mutate);\n"
    "  const resetRecheckShellyRef = useRef(flow.recheckShellyMutation.reset);\n"
    "  const onSettingsCloseRef = useRef(onSettingsClose);\n",
)
old_effect = """  useEffect(() => {
    if (!settingsOnlyDeviceId) return;
    const device = shellyDevices.find(
      (candidate) => candidate.id === settingsOnlyDeviceId
    );
    if (!device) {
      onSettingsClose?.();
      return;
    }
    resetRecheckShelly();
    recheckShelly(device);
  }, [
    onSettingsClose,
    recheckShelly,
    resetRecheckShelly,
    settingsOnlyDeviceId,
    shellyDevices
  ]);
"""
new_effect = """  useEffect(() => {
    settingsOnlyShellyRef.current = settingsOnlyShelly;
    recheckShellyRef.current = flow.recheckShellyMutation.mutate;
    resetRecheckShellyRef.current = flow.recheckShellyMutation.reset;
    onSettingsCloseRef.current = onSettingsClose;
  }, [
    flow.recheckShellyMutation.mutate,
    flow.recheckShellyMutation.reset,
    onSettingsClose,
    settingsOnlyShelly
  ]);

  useEffect(() => {
    if (!settingsOnlyDeviceId) return;
    const device = settingsOnlyShellyRef.current;
    if (!device) {
      onSettingsCloseRef.current?.();
      return;
    }
    resetRecheckShellyRef.current();
    recheckShellyRef.current(device);
  }, [settingsOnlyDeviceId]);
"""
if old_effect not in s:
    raise SystemExit('expected lint-v1 Shelly settings effect not found')
s = s.replace(old_effect, new_effect)
p.write_text(s)
