import {
  RPC_METHODS,
  type RelayTestResult,
  type Result,
  type ShellyClientError,
  type ShellyRpcRequest,
  type ShellyRpcTransport
} from '../model.js';
import { relayTestError, validationError } from './errors.js';
import { switchStatusSchema } from './validators.js';

type RelayMutation = (request: ShellyRpcRequest) => Promise<Result<null>>;

export const setShellyRelayState = (
  callMutation: RelayMutation,
  on: boolean,
  options?: { relayId?: number }
): Promise<Result<null>> => {
  const relayId = options?.relayId ?? 0;
  if (!Number.isInteger(relayId) || relayId < 0) {
    return Promise.resolve({
      ok: false,
      error: validationError(`Invalid Shelly relay id: ${relayId}.`)
    });
  }

  return callMutation({
    method: RPC_METHODS.SwitchSet,
    params: { id: relayId, on }
  });
};

export const runSafeShellyRelayTest = async (
  transport: ShellyRpcTransport,
  callMutation: RelayMutation,
  options?: { onDurationMs?: number }
): Promise<Result<RelayTestResult>> => {
  const onDurationMs = options?.onDurationMs ?? 500;
  let onCommandSent = false;
  let offCommandSent = false;
  let onError: ShellyClientError | undefined;
  let offError: ShellyClientError | undefined;

  try {
    const on = await setShellyRelayState(callMutation, true);
    if (!on.ok) {
      onError = on.error;
    } else {
      onCommandSent = true;
      const onStatus = await transport.call<unknown>({
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
    }
  } finally {
    const off = await setShellyRelayState(callMutation, false);
    offCommandSent = off.ok;
    if (!off.ok) {
      offError = off.error;
    }
  }

  if (offError) {
    return {
      ok: false,
      error: relayTestError(
        `Final relay OFF command failed; final state could not be confirmed. ${
          offError.technicalMessage ?? offError.kind
        }`
      )
    };
  }

  if (onError) {
    return { ok: false, error: onError };
  }

  const status = await transport.call<unknown>({
    method: RPC_METHODS.SwitchGetStatus,
    params: { id: 0 }
  });
  if (!status.ok) {
    return status;
  }
  const parsed = switchStatusSchema.safeParse(status.value);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error.message) };
  }
  if (parsed.data.output) {
    return {
      ok: false,
      error: relayTestError('Final relay state is ON after the safe relay test.')
    };
  }

  return {
    ok: true,
    value: {
      finalRelayOn: parsed.data.output,
      onCommandSent,
      offCommandSent
    }
  };
};
