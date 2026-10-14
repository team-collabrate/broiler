// Minimal Web Bluetooth ambient types — not in TypeScript's default DOM lib.
// Scoped to exactly the surface this app uses (device pairing + GATT writes
// for ESC/POS printing), not the full spec.

interface BluetoothCharacteristicProperties {
  readonly write: boolean;
  readonly writeWithoutResponse: boolean;
  readonly read: boolean;
  readonly notify: boolean;
}

interface BluetoothRemoteGATTCharacteristic {
  readonly uuid: string;
  readonly properties: BluetoothCharacteristicProperties;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  readonly uuid: string;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
}

interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
  optionalServices?: string[];
}

interface Bluetooth extends EventTarget {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  /** Not implemented in every Chrome build — always feature-detect before calling. */
  getDevices?(): Promise<BluetoothDevice[]>;
  getAvailability(): Promise<boolean>;
}

interface Navigator {
  readonly bluetooth: Bluetooth;
}
