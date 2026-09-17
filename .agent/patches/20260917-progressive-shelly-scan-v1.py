from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))

# Let the low-level scanner stream every successful discovery as it happens,
# while preserving the final sorted outcome for callers that still need it.
path = 'apps/mobile/src/flows/hardware-setup/shellyRequests.ts'
replace(
    path,
    """export type ScanShellySetupUrlsOptions = {\n  baseUrls: string[];\n  concurrency?: number;\n  signal?: AbortSignal;\n  stopAfterFirst?: boolean;\n};\n""",
    """export type ScanShellySetupUrlsOptions = {\n  baseUrls: string[];\n  concurrency?: number;\n  signal?: AbortSignal;\n  stopAfterFirst?: boolean;\n  onResult?: (result: ShellySetupScanResult) => void;\n};\n"""
)
replace(
    path,
    """  signal,\n  stopAfterFirst = true\n}: ScanShellySetupUrlsOptions): Promise<ShellySetupScanOutcome> => {\n""",
    """  signal,\n  stopAfterFirst = true,\n  onResult\n}: ScanShellySetupUrlsOptions): Promise<ShellySetupScanOutcome> => {\n"""
)
replace(
    path,
    """      try {\n        found.push({\n          index,\n          result: await readShellySetupScanResult(baseUrl, requestSignal)\n        });\n        if (stopAfterFirst) {\n""",
    """      try {\n        const result = await readShellySetupScanResult(baseUrl, requestSignal);\n        found.push({ index, result });\n        onResult?.(result);\n        if (stopAfterFirst) {\n"""
)

# Keep progressive results in hook state so React can render discoveries before
# the full subnet scan finishes.
path = 'apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.ts'
replace(
    path,
    """import { scanShellySetupUrls, type ShellySetupScanOutcome } from './shellyRequests.js';\n""",
    """import {\n  scanShellySetupUrls,\n  type ShellySetupScanOutcome,\n  type ShellySetupScanResult\n} from './shellyRequests.js';\n"""
)
replace(
    path,
    """  const [shellyScanStopped, setShellyScanStopped] = useState(false);\n  const shellyScanAbortControllerRef = useRef<AbortController | null>(null);\n""",
    """  const [shellyScanStopped, setShellyScanStopped] = useState(false);\n  const [shellyScanResults, setShellyScanResults] = useState<ShellySetupScanResult[]>([]);\n  const shellyScanAbortControllerRef = useRef<AbortController | null>(null);\n"""
)
replace(
    path,
    """        return await scanShellySetupUrls({\n          baseUrls,\n          signal: controller.signal,\n          stopAfterFirst: false\n        });\n""",
    """        return await scanShellySetupUrls({\n          baseUrls,\n          signal: controller.signal,\n          stopAfterFirst: false,\n          onResult: (result) => {\n            setShellyScanResults((current) =>\n              current.some((candidate) => candidate.baseUrl === result.baseUrl)\n                ? current\n                : [...current, result]\n            );\n          }\n        });\n"""
)
replace(
    path,
    """  const startShellyScan = () => {\n    setShellyScanStopped(false);\n    shellyScanMutation.mutate();\n  };\n""",
    """  const startShellyScan = () => {\n    setShellyScanStopped(false);\n    setShellyScanResults([]);\n    shellyScanMutation.mutate();\n  };\n"""
)
replace(
    path,
    """  const resetShellyScan = () => {\n    stopShellyScan();\n    setShellyScanStopped(false);\n    shellyScanMutation.reset();\n  };\n""",
    """  const resetShellyScan = () => {\n    stopShellyScan();\n    setShellyScanStopped(false);\n    setShellyScanResults([]);\n    shellyScanMutation.reset();\n  };\n"""
)
replace(
    path,
    """    shellyScanStopped,\n    shellyScanMutation,\n""",
    """    shellyScanStopped,\n    shellyScanResults,\n    shellyScanMutation,\n"""
)

# Thread the progressive state through the composed setup flow.
path = 'apps/mobile/src/flows/hardware-setup/useHardwareSetupFlow.ts'
replace(
    path,
    """    shellyScanStopped,\n    shellyScanMutation,\n""",
    """    shellyScanStopped,\n    shellyScanResults,\n    shellyScanMutation,\n""",
    2
)

path = 'apps/mobile/src/screens/hardware-setup/pageContracts.ts'
replace(
    path,
    """  | 'shellyScanMutation'\n  | 'shellyScanStartInput'\n""",
    """  | 'shellyScanMutation'\n  | 'shellyScanResults'\n  | 'shellyScanStartInput'\n"""
)

# Render streamed results instead of waiting for mutation.data at completion.
path = 'apps/mobile/src/screens/hardware-setup/pages/ShellySetupPage.tsx'
replace(
    path,
    """  const scanResults = flow.shellyScanMutation.data?.results ?? [];\n""",
    """  const scanResults = flow.shellyScanResults;\n"""
)

# Regression test: result must become observable while the mutation is still pending.
path = 'apps/mobile/src/flows/hardware-setup/useShellySetupScanFlow.test.ts'
replace(
    path,
    """import { act, renderHook } from '@testing-library/react';\nimport { createElement, type PropsWithChildren } from 'react';\nimport { describe, expect, it } from 'vitest';\n""",
    """import { act, renderHook, waitFor } from '@testing-library/react';\nimport { createElement, type PropsWithChildren } from 'react';\nimport { describe, expect, it, vi } from 'vitest';\n\nconst scanShellySetupUrlsMock = vi.hoisted(() => vi.fn());\n\nvi.mock('./shellyRequests.js', async (importOriginal) => {\n  const actual = await importOriginal<typeof import('./shellyRequests.js')>();\n  return { ...actual, scanShellySetupUrls: scanShellySetupUrlsMock };\n});\n"""
)
insert = """\n  it('publishes a found Shelly before the full range scan completes', async () => {\n    const queryClient = new QueryClient({\n      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }\n    });\n    const wrapper = ({ children }: PropsWithChildren) =>\n      createElement(QueryClientProvider, { client: queryClient }, children);\n    const found = {\n      baseUrl: 'http://192.168.0.10/',\n      deviceInfo: { id: 'shelly-test', model: 'S3PL-00112EU', gen: 3 }\n    };\n    let finishScan: (() => void) | undefined;\n    const keepScanning = new Promise<void>((resolve) => {\n      finishScan = resolve;\n    });\n    scanShellySetupUrlsMock.mockImplementationOnce(async ({ onResult }) => {\n      onResult?.(found);\n      await keepScanning;\n      return { results: [found], stopped: false };\n    });\n\n    const { result } = renderHook(() => useShellySetupScanFlow(), { wrapper });\n    act(() => result.current.startShellyScan());\n\n    await waitFor(() => expect(result.current.shellyScanResults).toEqual([found]));\n    expect(result.current.shellyScanMutation.isPending).toBe(true);\n\n    await act(async () => finishScan?.());\n    await waitFor(() => expect(result.current.shellyScanMutation.isSuccess).toBe(true));\n    queryClient.clear();\n  });\n"""
replace(path, "\n  it('allows an incomplete scan address while the user is editing without crashing render', () => {", insert + "\n  it('allows an incomplete scan address while the user is editing without crashing render', () => {")
