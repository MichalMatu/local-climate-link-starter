# 230 V safety policy

This app configures devices that can switch mains-powered loads. Safety defaults are non-negotiable.

## Defaults for heating

```text
boot state: OFF
fail-safe: OFF
sensor stale: OFF
max continuous ON time: enabled
min relay change interval: enabled
safe relay test: required before use
```

## App UX requirements

Before activating a heating profile, the app must show plain-language safety copy:

```text
Dla grzania domyślny tryb bezpieczeństwa to OFF.
Jeśli termometr zniknie, gniazdko zostanie wyłączone.
Nie używaj urządzeń przekraczających limit mocy gniazdka.
Nie zostawiaj niesprawdzonych grzejników bez nadzoru.
```

## Generated script requirements

Generated Shelly Script must:

```text
turn relay OFF on boot/start when configured
turn relay OFF on stale sensor
turn relay OFF on max ON timeout
never default to relay ON
avoid relay chatter with minChangeSec
log last decision reason
handle Switch.Set error paths
```

## Relay test

Safe relay test sequence:

```text
1. Confirm no heater/load is connected or user acknowledges test.
2. Switch.Set ON.
3. Wait short fixed duration.
4. Switch.Set OFF.
5. Verify Switch.GetStatus is OFF.
6. If any step fails, send OFF again and mark test failed.
```

Final state must be OFF even on failure.

## Manual control

Manual relay control must not weaken the heating safety defaults:

```text
ON: switch only the relay and keep automation state unchanged
OFF: switch only the relay and keep automation state unchanged
AUTO: start the thermostat automation and let the script decide relay state
MANUAL: stop the thermostat automation and leave relay OFF
```

The `MANUAL` action must send relay OFF even if stopping the automation script
returns an error. The user can turn the relay ON manually afterwards, but the app
must not leave heating ON as a side effect of disabling automation.
