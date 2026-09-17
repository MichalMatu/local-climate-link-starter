from pathlib import Path

feedback_path = Path('apps/mobile/src/screens/hardware-setup/pages/useShellySetupFeedback.ts')
feedback = feedback_path.read_text()
old_guard = '''      flow.startBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isPending ||
      flow.restartBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isError ||
      flow.restartBleDiscoveryMutation.isError ||
      flow.stopBleDiscoveryMutation.isPending
'''
new_guard = '''      flow.startBleDiscoveryMutation.isPending ||
      flow.refreshBleDiscoveryMutation.isPending ||
      flow.restartBleDiscoveryMutation.isPending ||
      flow.stopBleDiscoveryMutation.isPending
'''
if feedback.count(old_guard) != 1:
    raise SystemExit('Expected exactly one BLE polling guard')
feedback = feedback.replace(old_guard, new_guard, 1)
feedback_path.write_text(feedback)

test_path = Path('apps/mobile/src/__tests__/hardware-setup.test.tsx')
tests = test_path.read_text()
marker = "  it('keeps BLE scan refresh errors out of the visible UI', async () => {\n"
if tests.count(marker) != 1:
    raise SystemExit('Expected BLE refresh error test marker exactly once')
new_test = r'''  it('recovers Shelly BLE polling after one transient refresh failure', async () => {
    let bleScanReads = 0;
    const secondAddress = 'F7:5F:8D:0F:76:20';
    const defaultFetch = vi.mocked(fetch);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        if (url.pathname === '/script/4/ble-scan') {
          bleScanReads += 1;
          if (bleScanReads === 2) {
            return jsonResponse({ error: { code: 404, message: 'Not Found' } }, 404);
          }
          return jsonResponse({
            v: 1,
            r: true,
            sa: 1782667904992,
            so: null,
            lr: 'candidate-updated',
            c: [
              {
                a: 'A4:C1:38:4F:24:CD',
                p: 'x',
                t: 31.18,
                h: 44.06,
                r: -37,
                s: 1782667904992
              },
              ...(bleScanReads >= 3
                ? [
                    {
                      a: secondAddress,
                      p: 't',
                      t: 24.1,
                      h: 51,
                      r: -61,
                      s: 1782667908992
                    }
                  ]
                : [])
            ]
          });
        }
        return defaultFetch(input, init);
      })
    );

    renderHardwareSetup();
    await addShellyThroughUi();
    await openShellyBleScanFromSettings();

    const dialog = await screen.findByRole('dialog', {
      name: 'Skanuj termometry BLE'
    });
    const firstAddress = await findBleScanCandidate(dialog);
    const firstItem = firstAddress.closest('article');
    expect(firstItem).not.toBeNull();
    fireEvent.click(
      within(firstItem!).getByRole('button', { name: 'Zapisz termometr' })
    );
    expect(within(firstItem!).getByRole('button', { name: 'Już zapisany' })).toBeDisabled();

    const discoveryLifecycleCount = () =>
      vi
        .mocked(fetch)
        .mock.calls.map((call) => requestBody(call[1]))
        .filter(
          (body) =>
            (body.method === 'Script.Stop' || body.method === 'Script.Start') &&
            (body.params as { id?: number } | undefined)?.id === 4
        ).length;
    const lifecycleBeforeRecovery = discoveryLifecycleCount();

    await waitFor(() => expect(bleScanReads).toBeGreaterThanOrEqual(2), {
      timeout: 7000
    });
    expect(within(dialog).queryByText(secondAddress)).not.toBeInTheDocument();

    const recoveredCandidate = await within(dialog).findByText(secondAddress, undefined, {
      timeout: 7000
    });
    const recoveredItem = recoveredCandidate.closest('article');
    expect(recoveredItem).not.toBeNull();
    expect(
      within(recoveredItem!).getByRole('button', { name: 'Zapisz termometr' })
    ).toBeEnabled();
    expect(discoveryLifecycleCount()).toBe(lifecycleBeforeRecovery);
    expect(screen.queryByText('404 Not Found')).not.toBeInTheDocument();
  });

'''
tests = tests.replace(marker, new_test + marker, 1)
test_path.write_text(tests)
