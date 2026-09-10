from pathlib import Path

install_path = Path("packages/shelly-client/src/scripts/install.ts")
install = install_path.read_text()

old_duration = "const onDurationMs = options?.onDurationMs ?? 100;"
new_duration = "const onDurationMs = options?.onDurationMs ?? 1000;"
if install.count(old_duration) != 1:
    raise SystemExit("expected exactly one relay test duration")
install = install.replace(old_duration, new_duration)

old_pulse = """        onCommandSent = true;
        await new Promise((resolve) => setTimeout(resolve, onDurationMs));
"""
new_pulse = """        onCommandSent = true;
        const onStatus = await this.transport.call<unknown>({
          method: RPC_METHODS.SwitchGetStatus,
          params: { id: 0 }
        });
        if (!onStatus.ok) {
          onError = relayTestError(
            `Relay ON state could not be confirmed. ${
              onStatus.error.technicalMessage ?? onStatus.error.kind
            }`
          );
        } else {
          const parsedOn = switchStatusSchema.safeParse(onStatus.value);
          if (!parsedOn.success) {
            onError = relayTestError(
              `Relay ON status was invalid. ${parsedOn.error.message}`
            );
          } else if (!parsedOn.data.output) {
            onError = relayTestError(
              'Relay did not reach ON state during the safe relay test.'
            );
          } else {
            await new Promise((resolve) => setTimeout(resolve, onDurationMs));
          }
        }
"""
if install.count(old_pulse) != 1:
    raise SystemExit("expected exactly one relay test pulse block")
install_path.write_text(install.replace(old_pulse, new_pulse))

test_path = Path("packages/shelly-client/src/__tests__/shelly-client.test.ts")
tests = test_path.read_text()

old_options = """  failOffCommand?: boolean;
  scriptRunning?: boolean;
"""
new_options = """  failOffCommand?: boolean;
  forceRelayOffStatus?: boolean;
  scriptRunning?: boolean;
"""
if tests.count(old_options) != 1:
    raise SystemExit("expected recording transport options block")
tests = tests.replace(old_options, new_options)

old_status = """    if (request.method === RPC_METHODS.SwitchGetStatus) {
      return { ok: true, value: { id: 0, output: this.relayOn } as TResponse };
    }
"""
new_status = """    if (request.method === RPC_METHODS.SwitchGetStatus) {
      return {
        ok: true,
        value: {
          id: 0,
          output: this.options.forceRelayOffStatus ? false : this.relayOn
        } as TResponse
      };
    }
"""
if tests.count(old_status) != 1:
    raise SystemExit("expected Switch.GetStatus recording block")
tests = tests.replace(old_status, new_status)

old_test = """  it('safe relay test ends OFF', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);
    const result = await client.safeRelayTest({ onDurationMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.finalRelayOn).toBe(false);
    expect(transport.relayOn).toBe(false);
  });
"""
new_test = """  it('safe relay test confirms ON before ending OFF', async () => {
    const transport = new RecordingTransport();
    const client = new RpcShellyClient(transport);
    const result = await client.safeRelayTest({ onDurationMs: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.finalRelayOn).toBe(false);
    expect(transport.relayOn).toBe(false);
    expect(transport.requests.map((request) => request.method)).toEqual([
      RPC_METHODS.SwitchSet,
      RPC_METHODS.SwitchGetStatus,
      RPC_METHODS.SwitchSet,
      RPC_METHODS.SwitchGetStatus
    ]);
  });

  it('fails if the relay never reaches ON and still ends OFF', async () => {
    const transport = new RecordingTransport({ forceRelayOffStatus: true });
    const client = new RpcShellyClient(transport);
    const result = await client.safeRelayTest({ onDurationMs: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('relay-test-failed');
    expect(result.error.technicalMessage).toContain('did not reach ON state');
    expect(transport.relayOn).toBe(false);
  });
"""
if tests.count(old_test) != 1:
    raise SystemExit("expected safe relay test case")
test_path.write_text(tests.replace(old_test, new_test))
