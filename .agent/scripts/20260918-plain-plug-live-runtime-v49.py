from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# 1. Add a lightweight Shelly.GetStatus-only runtime snapshot.
shelly_requests = "apps/mobile/src/flows/hardware-setup/shellyRequests.ts"
replace_once(
    shelly_requests,
    "export type ShellyAutomationScriptState = {\n",
    "export type ShellyRuntimeStatus = Pick<\n"
    "  ShellyControlStatus,\n"
    "  'relayOn' | 'telemetry' | 'clock'\n"
    ">;\n\n"
    "export type ShellyAutomationScriptState = {\n",
)
replace_once(
    shelly_requests,
    "export const createShellyTransport = (baseUrl: string): FetchShellyRpcTransport =>\n"
    "  new FetchShellyRpcTransport({\n"
    "    baseUrl,\n"
    "    defaultTimeoutMs: 8000,\n"
    "    fetchImpl: createShellyFetch(8000)\n"
    "  });\n",
    "export const createShellyTransport = (baseUrl: string): FetchShellyRpcTransport =>\n"
    "  new FetchShellyRpcTransport({\n"
    "    baseUrl,\n"
    "    defaultTimeoutMs: 8000,\n"
    "    fetchImpl: createShellyFetch(8000)\n"
    "  });\n\n"
    "export const readShellyRuntimeStatus = async (\n"
    "  baseUrl: string\n"
    "): Promise<ShellyRuntimeStatus> => {\n"
    "  const client = new RpcShellyClient(createShellyTransport(baseUrl));\n"
    "  const status = unwrapShellyResult(await client.getStatus());\n"
    "  return {\n"
    "    relayOn: status.relayOn,\n"
    "    telemetry: status.telemetry,\n"
    "    clock: status.clock\n"
    "  };\n"
    "};\n",
)

# 2. Dedicated live runtime query for a plain saved plug.
Path("apps/mobile/src/flows/hardware-setup/usePlainShellyRuntime.ts").write_text(
    """import { RpcShellyClient } from '@lcl/shelly-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  createShellyTransport,
  readShellyRuntimeStatus,
  type ShellyRuntimeStatus,
  unwrapShellyResult
} from './shellyRequests.js';
import type { ShellyDraftDevice } from './setupDraftStore.js';

export const PLAIN_SHELLY_RUNTIME_REFRESH_MS = 5000;
const PLAIN_SHELLY_RUNTIME_SETTLE_MS = 1000;

export const plainShellyRuntimeQueryKey = (
  device: Pick<ShellyDraftDevice, 'id' | 'baseUrl'>
) => ['plain-shelly-runtime', device.id, device.baseUrl] as const;

type PlainShellyRuntimeOptions = {
  enabled?: boolean;
  refetchIntervalMs?: number;
};

export const usePlainShellyRuntime = (
  device: Pick<ShellyDraftDevice, 'id' | 'baseUrl'>,
  options: PlainShellyRuntimeOptions = {}
) => {
  const queryClient = useQueryClient();
  const settleTimerRef = useRef<number | null>(null);
  const queryKey = plainShellyRuntimeQueryKey(device);
  const query = useQuery({
    queryKey,
    queryFn: () => readShellyRuntimeStatus(device.baseUrl),
    enabled: options.enabled ?? true,
    retry: false,
    refetchInterval: options.refetchIntervalMs ?? PLAIN_SHELLY_RUNTIME_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  useEffect(
    () => () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    },
    []
  );

  const relayMutation = useMutation({
    mutationFn: async (relayOn: boolean) => {
      const client = new RpcShellyClient(createShellyTransport(device.baseUrl));
      unwrapShellyResult(relayOn ? await client.setRelayOn() : await client.setRelayOff());
      return relayOn;
    },
    onMutate: async (relayOn) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShellyRuntimeStatus>(queryKey);
      if (previous) {
        queryClient.setQueryData<ShellyRuntimeStatus>(queryKey, {
          ...previous,
          relayOn
        });
      }
      return { previous };
    },
    onError: (_error, _relayOn, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        void queryClient.refetchQueries({ queryKey, type: 'active' });
      }, PLAIN_SHELLY_RUNTIME_SETTLE_MS);
    }
  });

  return {
    status: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    isRelayPending: relayMutation.isPending,
    turnRelayOn: () => relayMutation.mutate(true),
    turnRelayOff: () => relayMutation.mutate(false)
  };
};
"""
)

# 3. Use the live query on plain Plug cards and include it in app-resume refreshes.
dashboard = "apps/mobile/src/screens/AutomationDashboardScreen.tsx"
replace_once(
    dashboard,
    "import { useCallback, useEffect, useRef, useState } from 'react';\n",
    "import { useCallback, useEffect, useState } from 'react';\n",
)
replace_once(
    dashboard,
    "import { useShellyControlFlow } from '../flows/hardware-setup/useShellyControlFlow.js';\n",
    "import { usePlainShellyRuntime } from '../flows/hardware-setup/usePlainShellyRuntime.js';\n",
)
replace_once(
    dashboard,
    "    root === 'installed-automation-control' ||\n    root === 'time-automation-runtime'\n",
    "    root === 'installed-automation-control' ||\n"
    "    root === 'time-automation-runtime' ||\n"
    "    root === 'plain-shelly-runtime'\n",
)
replace_once(
    dashboard,
    "  const { shellyControlStates, refreshShellyControl, turnRelayOn, turnRelayOff } =\n"
    "    useShellyControlFlow();\n"
    "  const refreshShellyControlRef = useRef(refreshShellyControl);\n"
    "  const controlState = shellyControlStates[device.id];\n"
    "  const status = controlState?.status ?? null;\n"
    "  const relayState = status?.relayOn;\n"
    "  const isBusy = controlState?.pendingAction != null;\n\n"
    "  useEffect(() => {\n"
    "    refreshShellyControlRef.current = refreshShellyControl;\n"
    "  }, [refreshShellyControl]);\n\n"
    "  useEffect(() => {\n"
    "    refreshShellyControlRef.current({ id: device.id, baseUrl: device.baseUrl });\n"
    "  }, [device.id, device.baseUrl]);\n",
    "  const { status, isRelayPending, turnRelayOn, turnRelayOff } =\n"
    "    usePlainShellyRuntime(device);\n"
    "  const relayState = status?.relayOn;\n"
    "  const isBusy = isRelayPending;\n",
)
replace_once(dashboard, "turnRelayOn(device);", "turnRelayOn();")
replace_once(dashboard, "turnRelayOff(device);", "turnRelayOff();")

# 4. Integration regression: relay can turn ON before apower catches up, then the card self-updates.
automation_test = "apps/mobile/src/__tests__/automation-dashboard.test.tsx"
marker = "  it('shows live runtime values from Shelly for a saved installation', async () => {\n"
regression = r'''  it('refreshes plain plug power after relay telemetry settles without remounting', async () => {
    let relayOn = false;
    let statusReads = 0;
    const rpcMethods: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        id?: number | string;
        method?: string;
        params?: { on?: boolean };
      };
      if (body.method) rpcMethods.push(body.method);
      let result: unknown = {};
      switch (body.method) {
        case 'Shelly.GetStatus': {
          statusReads += 1;
          const settledPower = relayOn && statusReads >= 3 ? 28.4 : 0;
          result = {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': {
              id: 0,
              output: relayOn,
              apower: settledPower,
              voltage: 243.2,
              current: settledPower > 0 ? 0.12 : 0,
              aenergy: { total: 25160 }
            },
            wifi: { rssi: -55 },
            sys: { time: '09:48', unixtime: 1_782_667_904, uptime: 12_345 }
          };
          break;
        }
        case 'Switch.Set':
          relayOn = body.params?.on === true;
          result = {};
          break;
      }
      return jsonResponse({ id: body.id ?? 1, result });
    });
    vi.stubGlobal('fetch', fetchMock);

    useHardwareSetupDraftStore.getState().upsertShellyDevice({
      id: 'http://192.168.0.31/',
      name: 'Lampa testowa',
      baseUrl: 'http://192.168.0.31/',
      scriptIdInput: '1'
    });
    renderDashboard();

    const card = screen.getByText('Lampa testowa').closest('article') as HTMLElement;
    expect(await within(card).findByText('0.0 W')).toBeVisible();

    const onButton = within(card).getByRole('button', { name: 'ON' });
    fireEvent.click(onButton);
    await waitFor(() => expect(onButton).toHaveAttribute('aria-pressed', 'true'));
    expect(within(card).getByText('0.0 W')).toBeVisible();

    expect(
      await within(card).findByText('28.4 W', {}, { timeout: 2500 })
    ).toBeVisible();
    expect(statusReads).toBeGreaterThanOrEqual(3);
    expect(rpcMethods).toContain('Switch.Set');
    expect(rpcMethods).not.toContain('Shelly.GetDeviceInfo');
    expect(rpcMethods).not.toContain('Script.List');
  });

'''
replace_once(automation_test, marker, regression + marker)

# 5. Focused hook test proves active polling itself is GetStatus-only.
Path("apps/mobile/src/flows/hardware-setup/usePlainShellyRuntime.test.tsx").write_text(
    """import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePlainShellyRuntime } from './usePlainShellyRuntime.js';

const jsonResponse = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const Probe = () => {
  const { status } = usePlainShellyRuntime(
    { id: 'plug-test', baseUrl: 'http://192.168.0.40/' },
    { refetchIntervalMs: 100 }
  );
  return <span>{status?.telemetry.powerW?.toFixed(1) ?? 'loading'}</span>;
};

describe('usePlainShellyRuntime', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('polls live plug telemetry with Shelly.GetStatus only', async () => {
    let statusReads = 0;
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          id?: number | string;
          method?: string;
        };
        if (body.method) methods.push(body.method);
        expect(body.method).toBe('Shelly.GetStatus');
        statusReads += 1;
        const powerW = statusReads >= 2 ? 17.6 : 0;
        return jsonResponse({
          id: body.id ?? 1,
          result: {
            matter: { enabled: false },
            script: { enable: true },
            ble: { enable: true },
            'switch:0': {
              id: 0,
              output: powerW > 0,
              apower: powerW,
              voltage: 230,
              current: powerW > 0 ? 0.08 : 0,
              aenergy: { total: 10 }
            },
            wifi: { rssi: -50 },
            sys: { time: '12:00', unixtime: 1_782_667_904, uptime: 100 }
          }
        });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    );

    expect(await screen.findByText('0.0')).toBeVisible();
    await waitFor(() => expect(screen.getByText('17.6')).toBeVisible(), {
      timeout: 1000
    });
    expect(statusReads).toBeGreaterThanOrEqual(2);
    expect(new Set(methods)).toEqual(new Set(['Shelly.GetStatus']));
  });
});
"""
)

# 6. Architecture docs + canonical handoff.
runtime_doc = Path("docs/architecture/runtime-control.md")
runtime_text = runtime_doc.read_text().rstrip()
runtime_text += """

## Plain Plug live telemetry

A saved Plug without an installed automation has its own lightweight dashboard runtime path. The Plug card must stay live while it is mounted instead of treating the first status read as a permanent snapshot.

- query key root: `plain-shelly-runtime`;
- active refresh interval: 5 seconds;
- background polling: disabled;
- mount, browser focus/reconnect and native app resume trigger a fresh read;
- each refresh uses only `Shelly.GetStatus` and never the heavier `Shelly.GetDeviceInfo` + `Script.List` control snapshot;
- relay ON/OFF is optimistic for the relay indicator, invalidates the live query immediately, then performs a second settle read after 1 second so delayed `apower` telemetry is not left at the pre-switch value.

Keep this path separate from installed-automation runtime ownership. A plain Plug card controls only the physical relay and telemetry; it does not infer or mutate climate AUTO/MANUAL state.
"""
runtime_doc.write_text(runtime_text + "\n")

handoff = Path("docs/HANDOFF_NEXT_CHAT.md")
handoff_text = handoff.read_text()
handoff_text = handoff_text.replace("Updated: 2026-09-17", "Updated: 2026-09-18", 1)
old_checkpoint = """## Current code checkpoint

Current product-code HEAD after architecture cleanup:

```text
c67ac66c10e076e4b5d798e11bf117eefca49ea3
Tighten hardware setup boundaries
```

Documentation later advanced the work branch to:

```text
0463af650bd647ebe300b7ec161323fda58e7520
Record prepared Android alpha build
```

No product code changed after `c67ac66c...` before the physical Android QA. The alpha installed on the phone therefore contains the product code from `c67ac66c...` plus documentation-only commits.
"""
new_checkpoint = """## Current code checkpoint

This branch is active development and has advanced beyond the original `c67ac66c...` cleanup checkpoint. Do not use the historical cleanup SHA as the current product HEAD. Always verify the exact continuation point with `git rev-parse HEAD` and the remote work branch before starting a task.

The current product model includes the later dashboard/thermometer/Shelly BLE fixes plus live plain-Plug telemetry described below.
"""
if old_checkpoint not in handoff_text:
    raise SystemExit("HANDOFF current checkpoint block not found")
handoff_text = handoff_text.replace(old_checkpoint, new_checkpoint, 1)
anchor = "## Diagnostics/logging decision\n"
plain_section = """## Plain Plug live runtime

Plain saved Plug cards are live runtime surfaces, not one-shot setup snapshots.

- `usePlainShellyRuntime` owns the dashboard query for a Plug that has no installed automation;
- the query polls every 5 s only while the card is active and uses only `Shelly.GetStatus`;
- native app resume is included in the dashboard runtime-query refetch predicate;
- ON/OFF updates the relay indicator optimistically, refreshes immediately, then performs a 1 s settle read so Shelly `apower` has time to catch up;
- generic `useShellyControlFlow` remains for setup/status responsibilities and is not used as the high-frequency telemetry loop;
- installed climate/time automations keep their existing dedicated runtime-query ownership.

Regression coverage must preserve both active polling and the delayed-power case where the first post-`Switch.Set` status still reports `0 W`.

"""
if anchor not in handoff_text:
    raise SystemExit("HANDOFF diagnostics anchor not found")
handoff.write_text(handoff_text.replace(anchor, plain_section + anchor, 1))

print("Applied plain Plug live runtime, tests, and documentation")
