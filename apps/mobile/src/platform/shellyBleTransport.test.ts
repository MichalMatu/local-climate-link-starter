import { describe, expect, it } from 'vitest';
import {
  RPC_METHODS,
  SHELLY_BLE_RPC_DATA_UUID,
  SHELLY_BLE_RPC_RX_CONTROL_UUID,
  SHELLY_BLE_RPC_TX_CONTROL_UUID,
  encodeShellyBleFrameLength,
  type ShellyBleGattPort
} from '@lcl/shelly-client';
import { createShellyBleTransport } from './shellyBleTransport.js';

class FakeGatt implements ShellyBleGattPort {
  connectedDeviceId: string | undefined;
  private requestId = 0;
  private responseBytes = new Uint8Array();
  private responseRead = false;

  async connect(deviceId: string): Promise<void> {
    this.connectedDeviceId = deviceId;
  }

  async disconnect(): Promise<void> {}

  async write(
    _deviceId: string,
    _serviceUuid: string,
    characteristicUuid: string,
    value: Uint8Array
  ): Promise<void> {
    if (characteristicUuid !== SHELLY_BLE_RPC_DATA_UUID) {
      expect(characteristicUuid).toBe(SHELLY_BLE_RPC_TX_CONTROL_UUID);
      return;
    }

    const request = JSON.parse(new TextDecoder().decode(value)) as { id: number };
    this.requestId = request.id;
    this.responseBytes = new TextEncoder().encode(
      JSON.stringify({
        id: this.requestId,
        result: { model: 'S3PL-00112EU' }
      })
    );
    this.responseRead = false;
  }

  async read(
    _deviceId: string,
    _serviceUuid: string,
    characteristicUuid: string
  ): Promise<Uint8Array> {
    if (characteristicUuid === SHELLY_BLE_RPC_RX_CONTROL_UUID) {
      const length = encodeShellyBleFrameLength(this.responseBytes.byteLength);
      if (!length.ok) {
        throw new Error(length.error.message);
      }
      return length.value;
    }

    expect(characteristicUuid).toBe(SHELLY_BLE_RPC_DATA_UUID);
    if (this.responseRead) {
      return new Uint8Array();
    }
    this.responseRead = true;
    return this.responseBytes;
  }
}

describe('createShellyBleTransport', () => {
  it('binds the selected BLE device id to Shelly RPC transport', async () => {
    const gatt = new FakeGatt();
    const transport = createShellyBleTransport('android-device-id', { gatt });

    const result = await transport.call<{ model: string }>({
      method: RPC_METHODS.ShellyGetDeviceInfo
    });

    expect(gatt.connectedDeviceId).toBe('android-device-id');
    expect(result).toEqual({
      ok: true,
      value: { model: 'S3PL-00112EU' }
    });
  });
});
